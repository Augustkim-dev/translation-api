const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

/**
 * 텍스트 번역 함수
 * @param {string} text - 번역할 텍스트
 * @param {string} targetLanguage - 대상 언어 코드 (예: 'en', 'ja', 'zh')
 * @param {string} sourceLanguage - 원본 언어 코드 (기본값: 'auto')
 * @returns {Object} 번역 결과
 */
async function translate(text, targetLanguage, sourceLanguage = 'auto') {
  return new Promise((resolve, reject) => {
    // 디버깅: 환경변수 확인
    console.log('🔍 Debug Info:');
    console.log('API Key length:', process.env.AZURE_TRANSLATOR_KEY?.length);
    console.log('API Key (first 10 chars):', process.env.AZURE_TRANSLATOR_KEY?.substring(0, 10) + '...');
    console.log('Endpoint:', process.env.AZURE_TRANSLATOR_ENDPOINT);

    // Azure Translator API 엔드포인트에서 호스트와 경로 분리
    const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT.replace('https://', '');
    const host = endpoint.split('/')[0];
    // from 파라미터는 auto가 아닐 때만 추가
    const queryParams = {
      'api-version': '3.0',
      'to': targetLanguage
    };
    
    // sourceLanguage가 'auto'가 아닐 때만 from 파라미터 추가
    if (sourceLanguage && sourceLanguage !== 'auto') {
      queryParams['from'] = sourceLanguage;
    }
    
    const path = '/translate?' + querystring.stringify(queryParams);

    const postData = JSON.stringify([{
      text: text
    }]);

    const options = {
      hostname: host,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': 'koreacentral' // 리소스 지역
      }
    };

    // 디버깅: 요청 정보 확인
    console.log('🌐 Request Info:');
    console.log('Host:', options.hostname);
    console.log('Path:', options.path);
    console.log('Headers:', {
      'Content-Type': options.headers['Content-Type'],
      'Ocp-Apim-Subscription-Key': options.headers['Ocp-Apim-Subscription-Key']?.substring(0, 10) + '...',
      'Ocp-Apim-Subscription-Region': options.headers['Ocp-Apim-Subscription-Region']
    });

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data)[0];
            resolve({
              translatedText: result.translations[0].text,
              sourceLanguage: result.detectedLanguage?.language || sourceLanguage,
              targetLanguage: targetLanguage,
              characterCount: text.length
            });
          } catch (error) {
            reject(new Error(`JSON parsing failed: ${error.message}`));
          }
        } else {
          console.error('API Response:', data);
          reject(new Error(`Translation failed with status: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { translate }; 