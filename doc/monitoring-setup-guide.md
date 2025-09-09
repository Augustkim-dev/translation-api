# 📊 Translation API - 모니터링 설정 가이드

## 🎯 Overview
Translation API의 종합적인 모니터링 시스템 구축 가이드입니다.

---

## ✅ 구현 완료 항목

### 1. 구조화된 로깅 시스템
**파일**: `api/index.js`

#### 특징:
- JSON 형식의 구조화된 로그
- 로그 레벨별 분류 (info, warn, error)
- 타임스탬프 및 메타데이터 포함
- Vercel 자동 수집 호환

#### 로그 예시:
```json
{
  "timestamp": "2025-01-09T12:00:00.000Z",
  "level": "info",
  "service": "translation-api",
  "environment": "production",
  "message": "Translation completed",
  "sourceLanguage": "ko",
  "targetLanguage": "en",
  "characterCount": 150,
  "duration": 245
}
```

### 2. 메트릭 수집 엔드포인트
**URL**: `GET /api/metrics`

#### 수집 메트릭:
- **요청 통계**
  - 총 요청 수
  - 엔드포인트별 요청 수
  - 에러 발생 수

- **번역 통계**
  - 총 번역 수
  - 언어쌍별 번역 수
  - 평균 텍스트 길이
  - 총 처리 문자 수

- **성능 메트릭**
  - 평균 응답 시간
  - 메모리 사용량
  - 업타임

#### API 응답 예시:
```json
{
  "requests": {
    "total": 1250,
    "translate": 1000,
    "health": 200,
    "errors": 50
  },
  "translations": {
    "total": 1000,
    "byLanguage": {
      "ko_to_en": 600,
      "en_to_ko": 300,
      "auto_to_ja": 100
    },
    "averageLength": 250,
    "totalCharacters": 250000
  },
  "performance": {
    "averageResponseTime": 150,
    "totalResponseTime": 150000,
    "requestCount": 1000
  },
  "memory": {
    "rss": 104857600,
    "heapTotal": 73728000,
    "heapUsed": 45000000,
    "external": 2000000
  },
  "uptime": 3600,
  "timestamp": "2025-01-09T12:00:00.000Z",
  "lastReset": "2025-01-09T11:00:00.000Z"
}
```

### 3. 웹 기반 모니터링 대시보드
**파일**: `web-test/monitoring.html`

#### 기능:
- 실시간 서비스 상태 확인
- 메트릭 시각화
- 언어별 번역 통계
- 성능 지표 표시
- 최근 활동 로그
- 10초 자동 새로고침

#### 접속 방법:
```bash
# 로컬에서 열기
start C:\My_Data\Study\translate_node\translation-mvp\web-test\monitoring.html

# 또는 브라우저에서 직접 열기
file:///C:/My_Data/Study/translate_node/translation-mvp/web-test/monitoring.html
```

---

## 🚀 Vercel 모니터링 활성화

### 1. Vercel Analytics 활성화
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. `translate-api` 프로젝트 선택
3. Analytics 탭 클릭
4. "Enable Analytics" 버튼 클릭
5. 자동으로 다음 데이터 수집 시작:
   - Page views
   - Unique visitors
   - Top pages
   - Top referrers
   - Geography
   - Devices

### 2. Vercel Functions 로그 확인

#### CLI로 실시간 로그 확인:
```bash
# 모든 로그 보기
vercel logs --follow

# 특정 함수 로그만 보기
vercel logs translate-api --source=lambda

# 최근 100개 로그
vercel logs -n 100

# 에러 로그만 필터링
vercel logs --filter error
```

#### 대시보드에서 로그 확인:
1. Vercel Dashboard → Functions 탭
2. 함수 선택 → Logs 탭
3. 실시간 로그 스트리밍 가능

---

## 🔔 외부 모니터링 도구 설정

### 1. UptimeRobot 설정 (무료)
1. [UptimeRobot](https://uptimerobot.com) 가입
2. "Add New Monitor" 클릭
3. 설정 입력:
   ```
   Monitor Type: HTTP(s)
   Friendly Name: Translation API Health
   URL: https://translate-api-five.vercel.app/health
   Monitoring Interval: 5 minutes
   ```
4. Alert Contacts 추가 (이메일, Slack 등)
5. Save Monitor

### 2. Better Uptime 설정 (더 나은 UI)
1. [Better Uptime](https://betteruptime.com) 가입
2. "Create monitor" 클릭
3. 설정:
   ```
   URL: https://translate-api-five.vercel.app/health
   Check frequency: 3 minutes
   Request timeout: 30 seconds
   Expected status codes: 200
   ```
4. Integrations 설정 (Slack, Discord, Email)

### 3. Sentry 에러 트래킹 (선택사항)
```bash
# Sentry SDK 설치
cd translation-mvp
npm install @sentry/node

# 환경변수 추가
vercel env add SENTRY_DSN
```

`api/index.js`에 Sentry 초기화 코드 추가:
```javascript
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
  });
}
```

---

## 📈 모니터링 지표 활용

### 주요 관찰 지표

#### 1. 성능 지표
- **평균 응답 시간**: 200ms 미만 유지
- **에러율**: 1% 미만 목표
- **메모리 사용률**: 80% 미만 유지

#### 2. 비즈니스 지표
- **일일 번역 요청 수**
- **가장 많이 사용되는 언어쌍**
- **평균 텍스트 길이**
- **피크 시간대 파악**

#### 3. 알림 설정 권장사항
- 응답 시간 > 1000ms
- 에러율 > 5%
- 5분 이상 다운타임
- 메모리 사용률 > 90%

### 대시보드 활용 팁

1. **정기 점검**
   - 매일 아침 대시보드 확인
   - 주간 성능 리포트 작성
   - 월간 사용량 분석

2. **문제 해결**
   - 에러 스파이크 발생 시 로그 확인
   - 성능 저하 시 메모리 사용량 체크
   - 특정 언어쌍 에러 집중 모니터링

3. **최적화 기회**
   - 자주 사용되는 언어쌍 캐싱 고려
   - 피크 시간대 스케일링 설정
   - 긴 텍스트 처리 최적화

---

## 🛠️ 트러블슈팅

### 메트릭이 수집되지 않을 때
```bash
# API 직접 테스트
curl https://translate-api-five.vercel.app/api/metrics

# 로그 확인
vercel logs --filter metrics
```

### 대시보드가 로드되지 않을 때
1. 브라우저 콘솔에서 에러 확인
2. API URL이 올바른지 확인
3. CORS 설정 확인

### 로그가 보이지 않을 때
```bash
# Vercel CLI 재로그인
vercel logout
vercel login

# 프로젝트 재연결
vercel link
```

---

## 📊 커스텀 알림 설정

### Slack 웹훅 연동
```javascript
// api/index.js에 추가
async function sendSlackAlert(message) {
  if (process.env.SLACK_WEBHOOK_URL) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
  }
}

// 에러 발생 시 알림
if (metrics.requests.errors > 10) {
  await sendSlackAlert(`⚠️ High error rate detected: ${metrics.requests.errors} errors`);
}
```

### Discord 웹훅 연동
```javascript
async function sendDiscordAlert(message) {
  if (process.env.DISCORD_WEBHOOK_URL) {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  }
}
```

---

## 📝 모니터링 체크리스트

### 일일 체크
- [ ] 서비스 상태 확인 (Health check)
- [ ] 에러 로그 확인
- [ ] 응답 시간 확인
- [ ] 메모리 사용량 확인

### 주간 체크
- [ ] 사용량 트렌드 분석
- [ ] 에러 패턴 분석
- [ ] 성능 최적화 기회 식별
- [ ] 알림 설정 검토

### 월간 체크
- [ ] 전체 메트릭 리포트 생성
- [ ] 인프라 스케일링 검토
- [ ] 모니터링 도구 업데이트
- [ ] 비용 분석

---

## 🔗 유용한 링크

- [Vercel Analytics Docs](https://vercel.com/docs/analytics)
- [Vercel Monitoring](https://vercel.com/docs/concepts/observability)
- [UptimeRobot API](https://uptimerobot.com/api)
- [Sentry for Node.js](https://docs.sentry.io/platforms/node/)

---

## 💡 Pro Tips

1. **로그 레벨 활용**
   - Production: info 이상만 로깅
   - Development: 모든 레벨 로깅

2. **메트릭 리텐션**
   - 메트릭은 메모리에 저장되므로 서버 재시작 시 초기화
   - 영구 저장이 필요하면 외부 DB 사용 고려

3. **알림 피로도 방지**
   - 중요도별 알림 채널 분리
   - 알림 임계값 적절히 설정
   - 반복 알림 방지 로직 구현

4. **보안 고려사항**
   - 메트릭 엔드포인트 인증 추가 고려
   - 민감한 정보 로깅 금지
   - IP 화이트리스트 설정

---

*Last Updated: 2025-01-09*
*Author: Translation API Monitoring System*