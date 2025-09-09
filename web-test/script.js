// API 설정
const API_BASE_URL = 'https://translate-api-five.vercel.app';
const API_TRANSLATE_URL = `${API_BASE_URL}/api/translate`;
const API_HEALTH_URL = `${API_BASE_URL}/health`;

// 페이지 로드 시 실행
window.addEventListener('DOMContentLoaded', () => {
    checkAPIStatus();
    setupCharacterCounter();
});

// API 상태 확인
async function checkAPIStatus() {
    const statusElement = document.getElementById('apiStatus');
    
    try {
        const response = await fetch(API_HEALTH_URL);
        if (response.ok) {
            const data = await response.json();
            statusElement.textContent = '✅ 정상 작동';
            statusElement.className = 'status-indicator status-ok';
        } else {
            statusElement.textContent = '⚠️ 연결 문제';
            statusElement.className = 'status-indicator status-warning';
        }
    } catch (error) {
        statusElement.textContent = '❌ 오프라인';
        statusElement.className = 'status-indicator status-error';
        console.error('API 상태 확인 실패:', error);
    }
}

// 문자 수 카운터 설정
function setupCharacterCounter() {
    const inputText = document.getElementById('inputText');
    const charCount = document.getElementById('charCount');
    
    inputText.addEventListener('input', () => {
        const count = inputText.value.length;
        charCount.textContent = count;
        
        if (count > 5000) {
            charCount.style.color = 'red';
            inputText.value = inputText.value.substring(0, 5000);
            charCount.textContent = 5000;
        } else if (count > 4500) {
            charCount.style.color = 'orange';
        } else {
            charCount.style.color = '';
        }
    });
}

// 번역 함수
async function translateText() {
    const inputText = document.getElementById('inputText').value;
    const sourceLanguage = document.getElementById('sourceLanguage').value;
    const targetLanguage = document.getElementById('targetLanguage').value;
    const resultDiv = document.getElementById('result');
    const translateBtn = document.querySelector('.translate-btn');

    // 입력 검증
    if (!inputText.trim()) {
        showError('번역할 텍스트를 입력해주세요.');
        return;
    }

    if (sourceLanguage !== 'auto' && sourceLanguage === targetLanguage) {
        showError('원본 언어와 대상 언어가 같습니다.');
        return;
    }

    // 로딩 상태 표시
    translateBtn.disabled = true;
    translateBtn.textContent = '번역 중...';
    resultDiv.innerHTML = '<div class="loading">번역 중입니다...</div>';

    try {
        const requestBody = {
            text: inputText,
            targetLanguage: targetLanguage
        };

        // sourceLanguage가 auto가 아닌 경우에만 포함
        if (sourceLanguage !== 'auto') {
            requestBody.sourceLanguage = sourceLanguage;
        }

        const response = await fetch(API_TRANSLATE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '번역 중 오류가 발생했습니다.');
        }

        // 결과 표시
        displayResult(result);
        
    } catch (error) {
        console.error('번역 오류:', error);
        showError(error.message);
    } finally {
        // 버튼 상태 복원
        translateBtn.disabled = false;
        translateBtn.textContent = '번역하기';
    }
}

// 결과 표시 함수
function displayResult(result) {
    const resultDiv = document.getElementById('result');
    
    const languageNames = {
        'ko': '한국어',
        'en': '영어',
        'ja': '일본어',
        'zh-Hans': '중국어(간체)',
        'zh-Hant': '중국어(번체)',
        'es': '스페인어',
        'fr': '프랑스어',
        'de': '독일어',
        'it': '이탈리아어',
        'pt': '포르투갈어',
        'ru': '러시아어',
        'th': '태국어',
        'vi': '베트남어',
        'id': '인도네시아어',
        'ms': '말레이어',
        'tl': '필리핀어',
        'hi': '힌디어',
        'bn': '벵골어',
        'ta': '타밀어',
        'ur': '우르두어',
        'mn': '몽골어',
        'kk': '카자흐어',
        'uz': '우즈베크어',
        'ar': '아랍어'
    };

    const sourceLang = languageNames[result.sourceLanguage] || result.sourceLanguage;
    const targetLang = languageNames[result.targetLanguage] || result.targetLanguage;

    resultDiv.innerHTML = `
        <div class="result-container">
            <div class="result-header">
                <h3>번역 결과</h3>
                <button onclick="copyToClipboard('${escapeHtml(result.translatedText)}')" class="copy-btn">
                    📋 복사
                </button>
            </div>
            <div class="translated-text">
                ${escapeHtml(result.translatedText)}
            </div>
            <div class="result-info">
                <span class="info-item">
                    <strong>원본:</strong> ${sourceLang}
                </span>
                <span class="info-item">
                    <strong>대상:</strong> ${targetLang}
                </span>
                <span class="info-item">
                    <strong>문자 수:</strong> ${result.characterCount}자
                </span>
            </div>
        </div>
    `;
}

// 에러 표시 함수
function showError(message) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <div class="error-container">
            <h3>⚠️ 오류</h3>
            <p>${escapeHtml(message)}</p>
            <p class="error-hint">다시 시도하거나 다른 언어를 선택해보세요.</p>
        </div>
    `;
}

// 언어 바꾸기 함수
function swapLanguages() {
    const sourceSelect = document.getElementById('sourceLanguage');
    const targetSelect = document.getElementById('targetLanguage');
    const inputText = document.getElementById('inputText');
    const resultDiv = document.getElementById('result');
    
    if (sourceSelect.value === 'auto') {
        // 모바일 친화적 알림
        showMobileAlert('자동 감지는 바꿀 수 없습니다.');
        return;
    }
    
    // 언어 교체
    const temp = sourceSelect.value;
    sourceSelect.value = targetSelect.value;
    targetSelect.value = temp;
    
    // 입력 텍스트와 결과가 있으면 자동으로 재번역
    if (inputText.value.trim() && resultDiv.querySelector('.translated-text')) {
        translateText();
    }
}

// 모바일 친화적 알림 함수
function showMobileAlert(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'mobile-alert';
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 1rem 2rem;
        border-radius: 10px;
        z-index: 9999;
        font-size: 1rem;
        min-width: 200px;
        text-align: center;
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            document.body.removeChild(alertDiv);
        }, 300);
    }, 2000);
}

// 초기화 함수
function clearAll() {
    document.getElementById('inputText').value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('result').innerHTML = `
        <div class="result-placeholder">
            번역 결과가 여기에 표시됩니다
        </div>
    `;
    document.getElementById('sourceLanguage').value = 'auto';
}

// 클립보드 복사 함수
function copyToClipboard(text) {
    // 임시 textarea 생성
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    // 선택 및 복사
    textarea.select();
    textarea.setSelectionRange(0, 99999); // 모바일 대응
    
    try {
        document.execCommand('copy');
        // 복사 성공 알림
        const copyBtn = document.querySelector('.copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ 복사됨!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('복사 실패:', err);
        alert('복사에 실패했습니다.');
    }
    
    // textarea 제거
    document.body.removeChild(textarea);
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Enter 키로 번역 실행
document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('inputText');
    inputText.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            translateText();
        }
    });
});