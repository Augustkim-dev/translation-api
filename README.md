# 번역기 MVP 프로젝트

Azure Translator를 활용한 실시간 번역 API 서버 및 테스트 웹페이지입니다.

## 🚀 배포 정보

- **Production URL**: https://translate-api-five.vercel.app
- **Health Check**: https://translate-api-five.vercel.app/health
- **API Endpoint**: https://translate-api-five.vercel.app/api/translate
- **자동 배포**: GitHub main 브랜치 푸시 시 자동 배포

## 📋 프로젝트 구조

```
translation-mvp/
├── server/              # 백엔드 API 서버
│   ├── app.js           # 메인 서버 파일
│   ├── translationService.js # 번역 서비스
│   ├── package.json
│   └── .env
├── web-test/            # 테스트용 웹페이지
│   ├── index.html
│   ├── style.css
│   └── script.js
├── README.md
└── .gitignore
```

## 🚀 시작하기

### 1. 환경 설정

1. Azure Translator API 키를 발급받으세요
2. `server/.env` 파일에 API 키를 설정하세요:
   ```
   AZURE_TRANSLATOR_KEY=your_api_key_here
   AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
   ```

### 2. 서버 실행

```bash
cd server
npm install
npm start
```

### 3. 웹페이지 테스트

`web-test/index.html` 파일을 브라우저에서 열어서 번역 기능을 테스트하세요.

## 🔧 API 명세

### 번역 API
```
POST /api/translate
Request: {
  "text": "번역할 텍스트",
  "targetLanguage": "en",
  "sourceLanguage": "ko" (선택사항)
}
Response: {
  "translatedText": "Translated text",
  "sourceLanguage": "ko",
  "targetLanguage": "en",
  "characterCount": 10
}
```

## 📝 개발 정보

- **기술스택**: Node.js, Express.js, Azure Translator API
- **개발 서버**: `npm run dev` (nodemon 사용)
- **프로덕션 서버**: `npm start` 