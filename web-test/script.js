async function translateText() {
    const text = document.getElementById('inputText').value;
    const targetLanguage = document.getElementById('targetLanguage').value;
    const resultDiv = document.getElementById('result');

    if (!text) {
        alert('텍스트를 입력해주세요.');
        return;
    }

    resultDiv.innerHTML = '번역 중...';

    try {
        const response = await fetch('http://localhost:3000/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                targetLanguage: targetLanguage
            })
        });

        const result = await response.json();
        
        if (result.error) {
            resultDiv.innerHTML = `에러: ${result.error}`;
        } else {
            resultDiv.innerHTML = `
                <h3>번역 결과:</h3>
                <p><strong>${result.translatedText}</strong></p>
                <p>원본 언어: ${result.sourceLanguage}</p>
                <p>대상 언어: ${result.targetLanguage}</p>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `에러: ${error.message}`;
    }
} 