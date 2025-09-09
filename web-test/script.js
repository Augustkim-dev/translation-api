// API 설정
const API_BASE_URL = 'https://translate-api-five.vercel.app';
const API_TRANSLATE_URL = `${API_BASE_URL}/api/translate`;
const API_HEALTH_URL = `${API_BASE_URL}/health`;

// TTS 설정
let currentUtterance = null;
let isSpeaking = false;

// 페이지 로드 시 실행
window.addEventListener('DOMContentLoaded', () => {
    checkAPIStatus();
    setupCharacterCounter();
    checkTTSSupport();
    // 음성 목록 로드
    if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
        // Chrome에서 음성 목록 비동기 로드 처리
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                console.log('음성 목록 로드 완료:', speechSynthesis.getVoices().length);
            };
        }
    }
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

    // 전역 변수에 번역 결과 저장
    window.lastTranslatedText = result.translatedText;
    window.lastTargetLanguage = result.targetLanguage;
    
    const ttsControls = checkTTSSupport() ? `
        <div class="tts-controls">
            <button onclick="speakText(window.lastTranslatedText, window.lastTargetLanguage)" class="speak-btn" id="speakBtn">
                🔊 읽기
            </button>
            <div class="speech-rate-control">
                <label for="speechRate">속도:</label>
                <input type="range" id="speechRate" min="0.5" max="2" step="0.1" value="1" 
                       onchange="changeSpeechRate(this.value)" oninput="changeSpeechRate(this.value)">
                <span id="rateDisplay">1x</span>
            </div>
        </div>
    ` : '';

    resultDiv.innerHTML = `
        <div class="result-container">
            <div class="result-header">
                <h3>번역 결과</h3>
                <div class="result-actions">
                    <button onclick="copyToClipboard(window.lastTranslatedText)" class="copy-btn">
                        📋 복사
                    </button>
                    ${ttsControls}
                </div>
            </div>
            <div class="translated-text" id="translatedTextContent">
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
    // text가 undefined인 경우 window.lastTranslatedText 사용
    const textToCopy = text || window.lastTranslatedText || '';
    
    // 임시 textarea 생성
    const textarea = document.createElement('textarea');
    textarea.value = textToCopy;
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

// TTS 지원 확인
function checkTTSSupport() {
    if (!('speechSynthesis' in window)) {
        console.warn('이 브라우저는 음성 합성을 지원하지 않습니다.');
        return false;
    }
    return true;
}

// 언어 코드를 음성 언어 코드로 매핑
function getVoiceLang(langCode) {
    const voiceLangMap = {
        'ko': 'ko-KR',
        'en': 'en-US',
        'ja': 'ja-JP',
        'zh-Hans': 'zh-CN',
        'zh-Hant': 'zh-TW',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT',
        'ru': 'ru-RU',
        'th': 'th-TH',
        'vi': 'vi-VN',
        'id': 'id-ID',
        'ms': 'ms-MY',
        'tl': 'fil-PH',
        'hi': 'hi-IN',
        'bn': 'bn-BD',
        'ta': 'ta-IN',
        'ur': 'ur-PK',
        'mn': 'mn-MN',
        'kk': 'kk-KZ',
        'uz': 'uz-UZ',
        'ar': 'ar-SA'
    };
    return voiceLangMap[langCode] || langCode;
}

// 텍스트 음성 읽기
function speakText(text, langCode) {
    console.log('speakText 호출:', text, langCode);
    
    if (!checkTTSSupport()) {
        showMobileAlert('음성 읽기를 지원하지 않는 브라우저입니다.');
        return;
    }

    // 이미 읽고 있으면 중지
    if (isSpeaking) {
        console.log('음성 중지');
        stopSpeaking();
        return;
    }

    try {
        const utterance = new SpeechSynthesisUtterance(text);
        const voiceLang = getVoiceLang(langCode);
        
        console.log('음성 언어:', voiceLang);
        
        // 언어 설정
        utterance.lang = voiceLang;
        
        // 속도 및 음량 설정
        utterance.rate = parseFloat(document.getElementById('speechRate')?.value || 1);
        utterance.volume = 1;
        utterance.pitch = 1;

        // 사용 가능한 음성 중 해당 언어 음성 선택
        const voices = speechSynthesis.getVoices();
        console.log('사용 가능한 음성 수:', voices.length);
        
        const langVoice = voices.find(voice => voice.lang.startsWith(voiceLang.split('-')[0]));
        if (langVoice) {
            utterance.voice = langVoice;
            console.log('선택된 음성:', langVoice.name);
        }

        // 이벤트 핸들러
        utterance.onstart = () => {
            console.log('음성 시작');
            isSpeaking = true;
            updateSpeakButton(true);
        };

        utterance.onend = () => {
            console.log('음성 종료');
            isSpeaking = false;
            updateSpeakButton(false);
        };

        utterance.onerror = (event) => {
            console.error('TTS 에러:', event);
            isSpeaking = false;
            updateSpeakButton(false);
            showMobileAlert('음성 읽기 중 오류가 발생했습니다.');
        };

        currentUtterance = utterance;
        speechSynthesis.cancel(); // 기존 큐 초기화
        speechSynthesis.speak(utterance);
    } catch (error) {
        console.error('음성 재생 오류:', error);
        showMobileAlert('음성 재생 중 오류가 발생했습니다.');
    }
}

// 음성 읽기 중지
function stopSpeaking() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }
    isSpeaking = false;
    updateSpeakButton(false);
}

// 음성 읽기 버튼 상태 업데이트
function updateSpeakButton(speaking) {
    const speakBtn = document.querySelector('.speak-btn');
    console.log('버튼 상태 업데이트:', speaking, speakBtn);
    if (speakBtn) {
        if (speaking) {
            speakBtn.innerHTML = '⏸️ 정지';
            speakBtn.classList.add('speaking');
        } else {
            speakBtn.innerHTML = '🔊 읽기';
            speakBtn.classList.remove('speaking');
        }
    }
}

// 음성 속도 변경
function changeSpeechRate(rate) {
    const rateDisplay = document.getElementById('rateDisplay');
    if (rateDisplay) {
        rateDisplay.textContent = `${rate}x`;
    }
    
    // 현재 읽고 있는 중이면 재시작
    if (isSpeaking && currentUtterance) {
        const text = currentUtterance.text;
        const lang = currentUtterance.lang;
        stopSpeaking();
        setTimeout(() => speakText(text, lang.split('-')[0]), 100);
    }
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