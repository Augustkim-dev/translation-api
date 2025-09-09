# Vercel 배포 가이드 - Windows 환경에서 GitHub 연동

## 📋 사전 준비 사항

### 필수 계정
- [ ] GitHub 계정 (https://github.com)
- [ ] Vercel 계정 (https://vercel.com)
- [ ] Azure Portal 계정 (API Key 발급용)

### 로컬 환경
- [ ] Node.js 18.x 이상 설치
- [ ] Git 설치
- [ ] Windows Terminal 또는 Git Bash

## 🚀 Step 1: 프로젝트 준비 (완료)

### 생성된 파일들
✅ **vercel.json** - Vercel 배포 설정
✅ **app.js** - Vercel 호환 수정
✅ **package.json** - Node.js 버전 명시
✅ **.env.example** - 환경변수 템플릿
✅ **.github/workflows/deploy.yml** - CI/CD 파이프라인

## 🔗 Step 2: GitHub 저장소 생성 및 연결

### 2.1 GitHub에서 새 저장소 생성
1. GitHub.com 로그인
2. "New repository" 클릭
3. Repository name: `translation-api`
4. Public/Private 선택
5. **중요**: "Initialize this repository with a README" 체크하지 않음
6. "Create repository" 클릭

### 2.2 로컬 저장소와 GitHub 연결
```bash
# PowerShell 또는 Git Bash에서 실행
cd C:\My_Data\Study\translate_node\translation-mvp

# 원격 저장소 추가 (YOUR_USERNAME을 실제 GitHub 사용자명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/translation-api.git

# 브랜치 이름을 main으로 설정
git branch -M main

# GitHub에 푸시
git push -u origin main
```

### 2.3 GitHub Personal Access Token 생성 (선택사항)
HTTPS로 푸시 시 인증이 필요한 경우:
1. GitHub → Settings → Developer settings → Personal access tokens
2. "Generate new token (classic)" 클릭
3. 권한 선택: repo, workflow
4. 토큰 복사 후 안전한 곳에 저장

## 💻 Step 3: Vercel CLI 설치 및 초기 배포

### 3.1 Vercel CLI 설치
```bash
# PowerShell 관리자 권한으로 실행
npm install -g vercel

# 설치 확인
vercel --version
```

### 3.2 Vercel 로그인
```bash
vercel login
# 이메일 입력 후 인증 메일 확인
```

### 3.3 프로젝트 배포
```bash
# server 디렉토리로 이동
cd server

# Vercel 배포 시작
vercel

# 대화형 프롬프트 응답:
# ? Set up and deploy "~\translation-mvp\server"? [Y/n] Y
# ? Which scope do you want to deploy to? [Your Account 선택]
# ? Link to existing project? [y/N] N
# ? What's your project's name? translation-api
# ? In which directory is your code located? ./
# ? Want to override the settings? [y/N] N
```

### 3.4 환경변수 설정
```bash
# CLI로 환경변수 추가
vercel env add AZURE_TRANSLATOR_KEY
# 프롬프트에서 실제 API 키 입력

vercel env add AZURE_TRANSLATOR_ENDPOINT
# https://api.cognitive.microsofttranslator.com/ 입력

# 또는 Vercel 대시보드에서 설정
# https://vercel.com/[YOUR_USERNAME]/translation-api/settings/environment-variables
```

## 🔄 Step 4: GitHub-Vercel 자동 배포 연동

### 4.1 Vercel 대시보드에서 GitHub 연동
1. https://vercel.com/dashboard 접속
2. "Import Project" 또는 "Add New..." → "Project" 클릭
3. "Import Git Repository" 선택
4. GitHub 계정 연결 및 권한 부여
5. `translation-api` 저장소 선택

### 4.2 프로젝트 설정
```
Framework Preset: Other
Root Directory: translation-mvp/server
Build Command: npm install (또는 비워둠)
Output Directory: (비워둠)
Install Command: npm install
```

### 4.3 환경변수 재설정
Import 시 환경변수 추가:
- `AZURE_TRANSLATOR_KEY`: [Azure API Key]
- `AZURE_TRANSLATOR_ENDPOINT`: https://api.cognitive.microsofttranslator.com/
- `NODE_ENV`: production

## 🔐 Step 5: GitHub Actions 설정

### 5.1 Vercel Token 생성
1. https://vercel.com/account/tokens 접속
2. "Create" 클릭
3. Token Name: `github-actions`
4. Scope: Full Account
5. 토큰 복사

### 5.2 GitHub Secrets 추가
GitHub 저장소 → Settings → Secrets and variables → Actions

추가할 Secrets:
```
VERCEL_TOKEN: [위에서 생성한 토큰]
VERCEL_ORG_ID: [Vercel 대시보드에서 확인]
VERCEL_PROJECT_ID: [Vercel 프로젝트 설정에서 확인]
```

### 5.3 Vercel 프로젝트 ID 확인
```bash
# server 디렉토리에서 실행
vercel link
cat .vercel/project.json
# orgId와 projectId 확인
```

## 🧪 Step 6: 배포 테스트

### 6.1 로컬 변경사항 테스트
```bash
# 코드 수정 후
git add .
git commit -m "Update: Add new feature"
git push origin main
```

### 6.2 배포 확인
1. GitHub Actions 탭에서 워크플로우 실행 확인
2. Vercel 대시보드에서 배포 상태 확인
3. 배포된 URL로 접속 테스트

### 6.3 API 테스트
```bash
# PowerShell에서 실행
$url = "https://translation-api.vercel.app"

# 헬스체크
Invoke-RestMethod -Uri "$url/health" -Method GET

# 번역 API 테스트
$body = @{
    text = "안녕하세요"
    targetLanguage = "en"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$url/api/translate" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

## 📊 Step 7: 모니터링 설정

### 7.1 Vercel Analytics
1. Vercel 대시보드 → Analytics 탭
2. "Enable Analytics" 클릭
3. 실시간 트래픽 및 성능 모니터링

### 7.2 Functions 로그
```bash
# CLI로 실시간 로그 확인
vercel logs --follow

# 특정 함수 로그만 보기
vercel logs translation-api --source=lambda
```

### 7.3 외부 모니터링 (선택사항)
- UptimeRobot: https://uptimerobot.com
- Better Uptime: https://betteruptime.com
- 모니터링 URL: `https://translation-api.vercel.app/health`

## 🌐 Step 8: 커스텀 도메인 설정 (선택사항)

### 8.1 도메인 추가
```bash
vercel domains add api.yourdomain.com
```

### 8.2 DNS 설정
도메인 제공업체 DNS 설정:
```
Type: CNAME
Name: api
Value: cname.vercel-dns.com
TTL: 3600
```

### 8.3 SSL 인증서
- Vercel이 자동으로 Let's Encrypt SSL 발급 및 관리

## 🔥 트러블슈팅

### 문제: "Module not found" 에러
```bash
# package-lock.json 재생성
cd server
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Fix: Update package-lock.json"
git push
```

### 문제: 환경변수 인식 안됨
```bash
# Vercel에서 환경변수 재배포
vercel env pull
vercel --prod --force
```

### 문제: 빌드 실패
```bash
# 로컬에서 빌드 테스트
vercel build
vercel dev  # 로컬 개발 서버로 테스트
```

### 문제: GitHub Actions 실패
```yaml
# .github/workflows/deploy.yml 수정
# working-directory 경로 확인
working-directory: ./translation-mvp/server  # 경로 수정
```

## ✅ 최종 체크리스트

### 배포 전
- [ ] 로컬에서 `npm start` 정상 동작
- [ ] `.env` 파일이 `.gitignore`에 포함
- [ ] `vercel.json` 파일 존재
- [ ] GitHub 저장소 생성 및 푸시 완료

### 배포 후
- [ ] Vercel 대시보드에서 "Ready" 상태
- [ ] 배포 URL 접속 가능
- [ ] `/health` 엔드포인트 응답 확인
- [ ] `/api/translate` API 테스트 성공
- [ ] GitHub push 시 자동 배포 확인

### 운영
- [ ] 에러 로그 모니터링 설정
- [ ] 사용량 모니터링
- [ ] 정기 백업 계획
- [ ] 스케일링 계획

## 📚 참고 자료

- [Vercel 공식 문서](https://vercel.com/docs)
- [Vercel CLI 가이드](https://vercel.com/docs/cli)
- [GitHub Actions for Vercel](https://github.com/marketplace/actions/vercel-action)
- [Vercel 환경변수 관리](https://vercel.com/docs/environment-variables)

## 💡 유용한 명령어 모음

```bash
# Vercel 상태 확인
vercel ls                    # 배포 목록
vercel inspect [url]         # 특정 배포 정보
vercel logs                  # 로그 확인

# 환경변수 관리
vercel env ls               # 환경변수 목록
vercel env add              # 환경변수 추가
vercel env rm [name]        # 환경변수 삭제
vercel env pull             # 로컬로 다운로드

# 배포 관리
vercel --prod               # 프로덕션 배포
vercel rollback             # 이전 버전 롤백
vercel rm [name]            # 배포 삭제

# 도메인 관리
vercel domains ls           # 도메인 목록
vercel alias                # 별칭 설정
```

## 🎉 완료!

축하합니다! 이제 번역 API가 Vercel에 성공적으로 배포되었습니다.

**배포된 URL**: `https://translation-api.vercel.app`

다음 단계:
1. 프로덕션 환경 테스트
2. 모니터링 대시보드 설정
3. 사용자 피드백 수집
4. 성능 최적화