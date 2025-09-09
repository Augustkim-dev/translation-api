# 테스트 서버 배포 가이드 - Vercel

## 📋 개요
Vercel을 사용한 번역 API 테스트 서버 구축 및 운영 가이드

## 🚀 1. Vercel CLI 설치

### Windows
```bash
npm install -g vercel
```

### Mac/Linux
```bash
npm install -g vercel
# 또는
yarn global add vercel
```

### 설치 확인
```bash
vercel --version
```

## 🔧 2. 프로젝트 준비

### 2.1 프로젝트 구조 수정
`translation-mvp/server/vercel.json` 파일 생성:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 2.2 package.json 수정
```json
{
  "name": "translation-api",
  "version": "1.0.0",
  "engines": {
    "node": "18.x"
  },
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js"
  }
}
```

### 2.3 app.js 수정 (Vercel 호환)
```javascript
// 맨 아래 추가
module.exports = app;

// 기존 app.listen 코드를 조건부로 수정
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}
```

## 📦 3. 초기 배포

### 3.1 Vercel 로그인
```bash
vercel login
# 이메일 인증 진행
```

### 3.2 프로젝트 배포
```bash
cd translation-mvp/server
vercel

# 대화형 설정
? Set up and deploy "~/translation-mvp/server"? [Y/n] Y
? Which scope do you want to deploy to? Your Account
? Link to existing project? [y/N] N
? What's your project's name? translation-api
? In which directory is your code located? ./
```

### 3.3 환경변수 설정
```bash
# CLI로 환경변수 추가
vercel env add AZURE_TRANSLATOR_KEY
vercel env add AZURE_TRANSLATOR_ENDPOINT

# 또는 Vercel 대시보드에서 설정
# https://vercel.com/dashboard → 프로젝트 선택 → Settings → Environment Variables
```

## 🔄 4. CI/CD 설정

### 4.1 GitHub 연동
```bash
# Git 저장소 초기화 (없는 경우)
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/translation-api.git
git push -u origin main
```

### 4.2 자동 배포 설정
1. Vercel 대시보드 접속
2. Import Git Repository 클릭
3. GitHub 저장소 선택
4. 자동 배포 활성화

### 4.3 브랜치별 배포
```yaml
# vercel.json에 추가
{
  "github": {
    "silent": true
  },
  "builds": [...],
  "routes": [...],
  "regions": ["icn1"],  # 서울 리전
  "functions": {
    "app.js": {
      "maxDuration": 10
    }
  }
}
```

## 📊 5. 모니터링 및 로그

### 5.1 실시간 로그 확인
```bash
vercel logs translation-api --follow
```

### 5.2 함수 로그 확인
```bash
vercel logs translation-api --source=lambda
```

### 5.3 대시보드 모니터링
- URL: https://vercel.com/dashboard
- Functions 탭: API 호출 통계
- Analytics 탭: 성능 메트릭
- Logs 탭: 실시간 로그

## 🚨 6. 도메인 설정

### 6.1 커스텀 도메인 추가
```bash
vercel domains add api.yourdomain.com
```

### 6.2 DNS 설정
```
Type: CNAME
Name: api
Value: cname.vercel-dns.com
```

### 6.3 SSL 인증서
- Vercel이 자동으로 Let's Encrypt SSL 발급 및 갱신

## 🔒 7. 보안 설정

### 7.1 CORS 설정
```javascript
// app.js
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
```

### 7.2 Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100 // 최대 100 요청
});

app.use('/api/', limiter);
```

### 7.3 환경변수 보안
```bash
# Production 환경변수만 설정
vercel env add AZURE_TRANSLATOR_KEY production
vercel env add NODE_ENV production --value="production"
```

## 📝 8. 배포 명령어 모음

### 기본 배포
```bash
vercel                  # 프로덕션 배포
vercel --prod          # 강제 프로덕션 배포
vercel --preview       # 프리뷰 배포
```

### 롤백
```bash
vercel ls              # 배포 목록 확인
vercel rollback        # 이전 버전으로 롤백
vercel rollback [url]  # 특정 버전으로 롤백
```

### 환경변수 관리
```bash
vercel env ls          # 환경변수 목록
vercel env add         # 환경변수 추가
vercel env rm          # 환경변수 삭제
vercel env pull        # 로컬로 환경변수 다운로드
```

### 도메인 관리
```bash
vercel domains ls      # 도메인 목록
vercel domains add     # 도메인 추가
vercel domains rm      # 도메인 삭제
vercel domains inspect # 도메인 정보 확인
```

## 🧪 9. 테스트 및 검증

### 9.1 배포 확인
```bash
# 배포 URL 확인
vercel ls

# API 테스트
curl -X POST https://translation-api.vercel.app/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"안녕하세요","targetLanguage":"en"}'
```

### 9.2 성능 테스트
```bash
# 간단한 부하 테스트
ab -n 100 -c 10 https://translation-api.vercel.app/api/translate
```

## 🔥 10. 트러블슈팅

### 빌드 실패
```bash
# 로컬에서 빌드 테스트
vercel build
vercel dev  # 로컬 개발 서버
```

### 환경변수 문제
```bash
# 환경변수 재설정
vercel env rm AZURE_TRANSLATOR_KEY
vercel env add AZURE_TRANSLATOR_KEY
vercel --prod --force  # 강제 재배포
```

### 함수 타임아웃
```json
// vercel.json
{
  "functions": {
    "app.js": {
      "maxDuration": 30  // 최대 30초 (Pro 플랜)
    }
  }
}
```

## 📋 11. 체크리스트

### 배포 전
- [ ] 환경변수 설정 확인
- [ ] vercel.json 파일 생성
- [ ] package.json engines 필드 추가
- [ ] 로컬 테스트 완료

### 배포 후
- [ ] 배포 URL 접속 확인
- [ ] API 엔드포인트 테스트
- [ ] 로그 모니터링 설정
- [ ] 커스텀 도메인 설정 (선택)

## 💰 12. 비용 관리

### 무료 플랜 제한
- 100GB 대역폭/월
- 100시간 빌드 시간/월
- 1000개 이미지 최적화/월
- 함수 실행 시간 10초

### Pro 플랜 ($20/월)
- 1TB 대역폭/월
- 400시간 빌드 시간/월
- 5000개 이미지 최적화/월
- 함수 실행 시간 60초

## 📚 참고 자료
- [Vercel 공식 문서](https://vercel.com/docs)
- [Vercel CLI 문서](https://vercel.com/docs/cli)
- [Vercel 환경변수 가이드](https://vercel.com/docs/environment-variables)
- [Vercel 함수 문서](https://vercel.com/docs/functions)