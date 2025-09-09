# 운영 서버 배포 가이드 - Docker Compose (자체 IDC)

## 📋 개요
자체 IDC 센터에서 Docker Compose를 활용한 번역 API 운영 서버 구축 가이드

## 🖥️ 1. 서버 환경 준비

### 1.1 시스템 요구사항
```
- OS: Ubuntu 22.04 LTS 또는 CentOS 8+
- CPU: 4 Core 이상
- RAM: 8GB 이상
- Storage: 50GB 이상 SSD
- Network: 고정 IP, 1Gbps 이상
```

### 1.2 기본 패키지 설치
```bash
# Ubuntu
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git vim htop net-tools

# CentOS
sudo yum update -y
sudo yum install -y curl wget git vim htop net-tools
```

## 🐳 2. Docker 설치

### 2.1 Docker Engine 설치
```bash
# Docker 공식 스크립트 사용
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
newgrp docker

# Docker 서비스 시작
sudo systemctl start docker
sudo systemctl enable docker

# 설치 확인
docker --version
```

### 2.2 Docker Compose 설치
```bash
# Docker Compose 최신 버전 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 실행 권한 부여
sudo chmod +x /usr/local/bin/docker-compose

# 설치 확인
docker-compose --version
```

## 📁 3. 프로젝트 구조 설정

### 3.1 디렉토리 구조
```bash
/opt/translation-api/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env
├── nginx/
│   ├── nginx.conf
│   └── ssl/
│       ├── cert.pem
│       └── key.pem
├── app/
│   ├── Dockerfile
│   ├── app.js
│   ├── translationService.js
│   ├── package.json
│   └── package-lock.json
├── volumes/
│   ├── logs/
│   ├── data/
│   └── backup/
└── scripts/
    ├── deploy.sh
    ├── backup.sh
    └── health-check.sh
```

### 3.2 디렉토리 생성
```bash
sudo mkdir -p /opt/translation-api/{nginx/ssl,app,volumes/{logs,data,backup},scripts}
cd /opt/translation-api
```

## 🔨 4. Docker 구성 파일 작성

### 4.1 Dockerfile (app/Dockerfile)
```dockerfile
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 비root 사용자로 실행
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 애플리케이션 실행
CMD ["node", "app.js"]
```

### 4.2 docker-compose.yml
```yaml
version: '3.8'

services:
  # Node.js 애플리케이션
  app:
    build:
      context: ./app
      dockerfile: Dockerfile
    container_name: translation-api
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
      - AZURE_TRANSLATOR_KEY=${AZURE_TRANSLATOR_KEY}
      - AZURE_TRANSLATOR_ENDPOINT=${AZURE_TRANSLATOR_ENDPOINT}
    volumes:
      - ./volumes/logs:/usr/src/app/logs
    networks:
      - translation-network
    depends_on:
      - redis
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  # Nginx 리버스 프록시
  nginx:
    image: nginx:alpine
    container_name: translation-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./volumes/logs/nginx:/var/log/nginx
    networks:
      - translation-network
    depends_on:
      - app

  # Redis 캐시
  redis:
    image: redis:7-alpine
    container_name: translation-redis
    restart: always
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - ./volumes/data/redis:/data
    networks:
      - translation-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # Prometheus 모니터링
  prometheus:
    image: prom/prometheus
    container_name: translation-prometheus
    restart: always
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./volumes/data/prometheus:/prometheus
    ports:
      - "9090:9090"
    networks:
      - translation-network
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'

  # Grafana 대시보드
  grafana:
    image: grafana/grafana
    container_name: translation-grafana
    restart: always
    ports:
      - "3001:3000"
    volumes:
      - ./volumes/data/grafana:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_INSTALL_PLUGINS=redis-datasource
    networks:
      - translation-network

networks:
  translation-network:
    driver: bridge

volumes:
  logs:
  data:
  backup:
```

### 4.3 docker-compose.prod.yml (운영 환경 오버라이드)
```yaml
version: '3.8'

services:
  app:
    image: translation-api:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3

  nginx:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
```

### 4.4 Nginx 설정 (nginx/nginx.conf)
```nginx
events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    upstream translation-api {
        least_conn;
        server app:3000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    # 로그 포맷
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # 기본 설정
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip 압축
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_status 429;

    # SSL 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HTTP 서버
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # HTTPS 서버
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # 보안 헤더
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API 프록시
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://translation-api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # 타임아웃 설정
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # 헬스체크
        location /health {
            access_log off;
            proxy_pass http://translation-api;
        }

        # 메트릭스
        location /metrics {
            allow 127.0.0.1;
            deny all;
            proxy_pass http://translation-api;
        }
    }
}
```

## 🔐 5. 환경변수 설정

### 5.1 .env 파일 생성
```bash
cat > /opt/translation-api/.env << EOF
# Azure Translator
AZURE_TRANSLATOR_KEY=your_azure_key_here
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/

# Grafana
GRAFANA_PASSWORD=secure_password_here

# Node Environment
NODE_ENV=production
LOG_LEVEL=info

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
EOF

# 권한 설정
chmod 600 /opt/translation-api/.env
```

## 🚀 6. 배포 스크립트

### 6.1 배포 스크립트 (scripts/deploy.sh)
```bash
#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 변수
APP_DIR="/opt/translation-api"
BACKUP_DIR="$APP_DIR/volumes/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}🚀 번역 API 배포 시작${NC}"

# 1. 백업
echo -e "${YELLOW}📦 현재 버전 백업 중...${NC}"
if [ -d "$APP_DIR/app" ]; then
    tar -czf "$BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz" -C "$APP_DIR" app/
    echo -e "${GREEN}✅ 백업 완료: app_backup_$TIMESTAMP.tar.gz${NC}"
fi

# 2. 코드 업데이트
echo -e "${YELLOW}📥 코드 업데이트 중...${NC}"
cd $APP_DIR
git pull origin main

# 3. Docker 이미지 빌드
echo -e "${YELLOW}🔨 Docker 이미지 빌드 중...${NC}"
docker-compose build --no-cache app

# 4. 헬스체크
echo -e "${YELLOW}🏥 헬스체크 수행 중...${NC}"
docker-compose run --rm app node -e "console.log('Health check passed')"

# 5. 무중단 배포
echo -e "${YELLOW}🔄 무중단 배포 시작...${NC}"
docker-compose up -d --no-deps --scale app=3 app

# 이전 컨테이너 제거를 위한 대기
sleep 10

# 6. 이전 컨테이너 정리
echo -e "${YELLOW}🧹 이전 컨테이너 정리 중...${NC}"
docker-compose up -d --no-deps --scale app=2 app
docker system prune -f

# 7. 배포 확인
echo -e "${YELLOW}✨ 배포 상태 확인 중...${NC}"
docker-compose ps

# 8. 로그 확인
echo -e "${YELLOW}📋 최근 로그:${NC}"
docker-compose logs --tail=20 app

echo -e "${GREEN}✅ 배포 완료!${NC}"
```

### 6.2 백업 스크립트 (scripts/backup.sh)
```bash
#!/bin/bash

# 백업 설정
BACKUP_DIR="/opt/translation-api/volumes/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 데이터 백업
echo "🔄 백업 시작: $TIMESTAMP"

# Redis 백업
docker exec translation-redis redis-cli BGSAVE
sleep 5
docker cp translation-redis:/data/dump.rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

# 로그 백업
tar -czf "$BACKUP_DIR/logs_$TIMESTAMP.tar.gz" -C /opt/translation-api/volumes logs/

# 오래된 백업 삭제
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "✅ 백업 완료"

# 원격 백업 (옵션)
# rsync -avz $BACKUP_DIR/ backup-server:/backups/translation-api/
```

### 6.3 헬스체크 스크립트 (scripts/health-check.sh)
```bash
#!/bin/bash

# 헬스체크 URL
HEALTH_URL="http://localhost/health"
TELEGRAM_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_chat_id"

# 헬스체크 수행
response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -ne 200 ]; then
    message="⚠️ Translation API Health Check Failed! Status: $response"
    
    # Telegram 알림
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$message"
    
    # 서비스 재시작 시도
    docker-compose restart app
    
    echo "$(date): Health check failed - $response" >> /opt/translation-api/volumes/logs/health.log
else
    echo "$(date): Health check passed" >> /opt/translation-api/volumes/logs/health.log
fi
```

## 🔒 7. SSL 인증서 설정

### 7.1 Let's Encrypt 인증서 발급
```bash
# Certbot 설치
sudo apt install certbot

# 인증서 발급
sudo certbot certonly --standalone -d api.yourdomain.com

# 인증서 복사
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem /opt/translation-api/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem /opt/translation-api/nginx/ssl/key.pem

# 자동 갱신 설정
echo "0 0 * * 0 root certbot renew --quiet && docker-compose -f /opt/translation-api/docker-compose.yml restart nginx" >> /etc/crontab
```

## 📊 8. 모니터링 설정

### 8.1 Prometheus 설정 (prometheus/prometheus.yml)
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'translation-api'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

### 8.2 Grafana 대시보드 접속
```
URL: http://your-server-ip:3001
Username: admin
Password: (설정한 GRAFANA_PASSWORD)
```

## 🚦 9. 운영 명령어

### 서비스 관리
```bash
# 서비스 시작
docker-compose up -d

# 서비스 중지
docker-compose down

# 서비스 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart app

# 로그 확인
docker-compose logs -f app
docker-compose logs --tail=100 nginx

# 상태 확인
docker-compose ps
docker stats
```

### 스케일링
```bash
# 앱 인스턴스 늘리기
docker-compose up -d --scale app=5

# 앱 인스턴스 줄이기
docker-compose up -d --scale app=2
```

### 유지보수
```bash
# 컨테이너 정리
docker system prune -a

# 볼륨 정리
docker volume prune

# 이미지 업데이트
docker-compose pull
docker-compose up -d
```

## 🔥 10. 트러블슈팅

### 메모리 부족
```bash
# 메모리 확인
free -h
docker stats

# 메모리 제한 조정
# docker-compose.yml의 deploy.resources.limits.memory 수정
```

### 디스크 공간 부족
```bash
# 디스크 사용량 확인
df -h
du -sh /opt/translation-api/volumes/*

# Docker 정리
docker system prune -a --volumes
```

### 네트워크 문제
```bash
# 네트워크 확인
docker network ls
docker network inspect translation-api_translation-network

# 네트워크 재생성
docker-compose down
docker network prune
docker-compose up -d
```

## ✅ 11. 운영 체크리스트

### 배포 전
- [ ] 백업 스크립트 테스트
- [ ] SSL 인증서 설정
- [ ] 환경변수 확인
- [ ] 디스크 공간 확인 (최소 10GB)

### 배포 후
- [ ] 헬스체크 통과 확인
- [ ] API 엔드포인트 테스트
- [ ] 모니터링 대시보드 확인
- [ ] 로그 수집 정상 동작

### 일일 점검
- [ ] 서비스 상태 확인
- [ ] 리소스 사용량 확인
- [ ] 에러 로그 확인
- [ ] 백업 수행 확인

### 주간 점검
- [ ] 보안 업데이트 확인
- [ ] 성능 메트릭 분석
- [ ] 백업 복구 테스트
- [ ] 디스크 정리

## 📈 12. 성능 최적화

### 캐싱 전략
```javascript
// Redis 캐싱 적용 (app.js에 추가)
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

// 캐시 키 생성
function getCacheKey(text, targetLang) {
  return `trans:${targetLang}:${crypto.createHash('md5').update(text).digest('hex')}`;
}
```

### 로드 밸런싱
```nginx
# nginx.conf upstream 설정
upstream translation-api {
    ip_hash;  # 세션 고정
    server app_1:3000 weight=3;
    server app_2:3000 weight=2;
    server app_3:3000 weight=1;
}
```

## 🔐 13. 보안 강화

### 방화벽 설정
```bash
# UFW 설정
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3001/tcp # Grafana (내부망만)
sudo ufw enable
```

### Fail2ban 설정
```bash
# Fail2ban 설치
sudo apt install fail2ban

# 설정 파일 생성
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /opt/translation-api/volumes/logs/nginx/error.log
EOF

sudo systemctl restart fail2ban
```

## 📚 참고 자료
- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Nginx 설정 가이드](https://nginx.org/en/docs/)
- [Prometheus 모니터링](https://prometheus.io/docs/)
- [Grafana 대시보드](https://grafana.com/docs/)