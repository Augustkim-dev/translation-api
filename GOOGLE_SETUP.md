# Google Cloud Translation API 설정 가이드

## 1. Google Cloud 프로젝트 설정

### 1.1 프로젝트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 프로젝트 ID 기록

### 1.2 Translation API 활성화
1. API 및 서비스 > 라이브러리로 이동
2. "Cloud Translation API" 검색
3. "사용 설정" 클릭

### 1.3 결제 계정 연결
- 무료 크레딧 $300 (신규 사용자)
- 월 50만 자 무료 사용

## 2. 서비스 계정 및 인증 키 생성

### 2.1 서비스 계정 생성
1. IAM 및 관리자 > 서비스 계정으로 이동
2. "서비스 계정 만들기" 클릭
3. 서비스 계정 이름 입력 (예: translation-api-service)
4. "만들기 및 계속" 클릭

### 2.2 역할 부여
1. 역할 선택: "Cloud Translation API 사용자" 또는 "Cloud Translation API 편집자"
2. "계속" 클릭
3. "완료" 클릭

### 2.3 키 생성
1. 생성된 서비스 계정 클릭
2. "키" 탭으로 이동
3. "키 추가" > "새 키 만들기"
4. JSON 형식 선택
5. "만들기" 클릭 - JSON 파일이 자동 다운로드됨

## 3. 프로젝트 설정

### 3.1 인증 파일 배치
```bash
# credentials 디렉토리 생성
mkdir translation-mvp/server/credentials

# 다운로드한 JSON 파일을 복사
cp ~/Downloads/your-project-xxxxx.json translation-mvp/server/credentials/google-translate.json
```

### 3.2 환경 변수 설정
`translation-mvp/server/.env` 파일 수정:
```env
# Google Cloud Translation API 설정
GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-translate.json
GOOGLE_MONTHLY_LIMIT=500000
GOOGLE_DAILY_LIMIT=17000
```

### 3.3 .gitignore 업데이트
```gitignore
# Google Cloud 인증 파일
credentials/
*.json
```

## 4. 테스트

### 4.1 서버 시작
```bash
cd translation-mvp/server
npm run dev
```

### 4.2 Health Check
```bash
curl http://localhost:3000/api/health
```

### 4.3 번역 테스트
```bash
curl -X POST http://localhost:3000/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "안녕하세요",
    "targetLanguage": "en"
  }'
```

## 5. 사용량 모니터링

### 5.1 Google Cloud Console
- [Google Cloud Console](https://console.cloud.google.com/) > API 및 서비스 > 측정항목
- 일일/월간 사용량 확인
- 할당량 및 한도 모니터링

### 5.2 로컬 모니터링
```bash
# 사용량 통계 확인
curl http://localhost:3000/api/usage
```

### 5.3 모니터링 대시보드
브라우저에서 `translation-mvp/web-test/monitoring.html` 열기

## 6. 비용 관리

### 6.1 무료 사용량
- 월 50만 자 무료
- 초과 시: $20 / 100만 자

### 6.2 예산 알림 설정
1. Google Cloud Console > 결제 > 예산 및 알림
2. "예산 만들기" 클릭
3. 월 예산 금액 설정
4. 알림 임계값 설정 (50%, 90%, 100%)

### 6.3 API 키 제한
1. API 및 서비스 > 사용자 인증 정보
2. API 키 선택
3. "API 제한사항" 설정
4. IP 주소 또는 리퍼러 제한 추가

## 7. 문제 해결

### 인증 오류 (401/403)
- 서비스 계정 키 파일 경로 확인
- API 활성화 상태 확인
- 서비스 계정 권한 확인

### 할당량 초과 (429)
- 일일/월간 한도 확인
- Azure로 자동 폴백됨
- 사용량 모니터링 강화

### 연결 실패
- 네트워크 연결 확인
- 방화벽 설정 확인
- Google Cloud 서비스 상태 확인

## 8. 보안 권장사항

1. **서비스 계정 키 보호**
   - 절대 GitHub에 커밋하지 않기
   - 환경 변수 또는 시크릿 관리 도구 사용

2. **최소 권한 원칙**
   - Translation API만 사용하도록 권한 제한
   - 불필요한 API 비활성화

3. **정기적인 키 순환**
   - 3-6개월마다 새 키 생성
   - 이전 키 폐기

4. **모니터링 및 알림**
   - 비정상적인 사용 패턴 감지
   - 예산 초과 알림 설정