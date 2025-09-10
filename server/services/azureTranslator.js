const https = require('https');
const querystring = require('querystring');
require('dotenv').config();

class AzureTranslator {
  constructor() {
    this.apiKey = process.env.AZURE_TRANSLATOR_KEY;
    this.endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
    this.region = process.env.AZURE_TRANSLATOR_REGION || 'koreacentral';
    this.isAvailable = this.checkConfiguration();
  }

  checkConfiguration() {
    if (!this.apiKey || !this.endpoint) {
      console.log('⚠️ Azure Translator 설정 없음 - API 키와 엔드포인트 필요');
      return false;
    }
    console.log('✅ Azure Translator 서비스 초기화 완료');
    return true;
  }

  /**
   * 텍스트 번역
   * @param {string} text - 번역할 텍스트
   * @param {string} targetLanguage - 대상 언어 코드
   * @param {string} sourceLanguage - 원본 언어 코드 (optional)
   * @returns {Object} 번역 결과
   */
  async translate(text, targetLanguage, sourceLanguage = 'auto') {
    if (!this.isAvailable) {
      throw new Error('Azure Translator 서비스를 사용할 수 없습니다. API 키와 엔드포인트를 확인하세요.');
    }

    // 텍스트 길이 체크 (Azure 한도: 50,000자)
    if (text.length > 50000) {
      throw new Error(`텍스트가 너무 깁니다. (현재: ${text.length}자, 최대: 50,000자)`);
    }

    return new Promise((resolve, reject) => {
      const endpoint = this.endpoint.replace('https://', '');
      const host = endpoint.split('/')[0];
      
      const queryParams = {
        'api-version': '3.0',
        'to': targetLanguage
      };
      
      // sourceLanguage가 'auto'가 아닐 때만 from 파라미터 추가
      if (sourceLanguage && sourceLanguage !== 'auto') {
        queryParams['from'] = sourceLanguage;
      }
      
      const path = '/translate?' + querystring.stringify(queryParams);
      const postData = JSON.stringify([{ text: text }]);

      const options = {
        hostname: host,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Ocp-Apim-Subscription-Region': this.region
        }
      };

      console.log('🌐 Azure Translator 요청:', {
        textLength: text.length,
        to: targetLanguage,
        from: sourceLanguage || 'auto-detect'
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
              const response = {
                translatedText: result.translations[0].text,
                sourceLanguage: result.detectedLanguage?.language || sourceLanguage,
                targetLanguage: targetLanguage,
                characterCount: text.length,
                service: 'azure'
              };

              console.log('✅ Azure Translator 성공:', {
                sourceLanguage: response.sourceLanguage,
                targetLanguage: response.targetLanguage,
                characterCount: response.characterCount
              });

              resolve(response);
            } catch (error) {
              reject(new Error(`Azure JSON 파싱 실패: ${error.message}`));
            }
          } else {
            console.error('❌ Azure API 응답 오류:', res.statusCode, data);
            
            // 에러 코드별 처리
            if (res.statusCode === 401) {
              reject(new Error('Azure Translator API 인증 실패 - API 키 확인 필요'));
            } else if (res.statusCode === 429) {
              reject(new Error(
                'Azure Translator API 요청 제한 초과\n' +
                '무료 한도(월 200만자)를 초과했습니다.\n' +
                '다음 달 1일에 자동으로 리셋됩니다.'
              ));
            } else if (res.statusCode === 403) {
              reject(new Error(
                'Azure Translator API 할당량 초과 또는 권한 없음\n' +
                'Azure Portal에서 리소스 상태를 확인하세요.'
              ));
            } else {
              const errorData = this.parseErrorResponse(data);
              reject(new Error(`Azure Translator 오류 (${res.statusCode}): ${errorData}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Azure 요청 오류:', error);
        reject(new Error(`Azure 요청 실패: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 에러 응답 파싱
   * @param {string} data - 에러 응답 데이터
   * @returns {string} 에러 메시지
   */
  parseErrorResponse(data) {
    try {
      const error = JSON.parse(data);
      return error.error?.message || error.message || data;
    } catch {
      return data;
    }
  }

  /**
   * 서비스 상태 확인
   * @returns {Object} 서비스 상태 정보
   */
  async checkHealth() {
    const health = {
      service: 'azure',
      available: this.isAvailable,
      configured: !!(this.apiKey && this.endpoint),
      region: this.region
    };

    if (this.isAvailable) {
      try {
        // 간단한 테스트 번역으로 실제 연결 확인
        await this.translate('test', 'en');
        health.status = 'healthy';
        health.lastCheck = new Date().toISOString();
      } catch (error) {
        health.status = 'unhealthy';
        health.error = error.message;
        
        // 할당량 초과 여부 확인
        if (error.message.includes('할당량') || error.message.includes('429')) {
          health.quotaExceeded = true;
        }
      }
    } else {
      health.status = 'not_configured';
    }

    return health;
  }

  /**
   * 지원 언어 목록
   * @returns {Array} 지원 언어 목록
   */
  getSupportedLanguages() {
    return [
      { code: 'ko', name: '한국어' },
      { code: 'en', name: '영어' },
      { code: 'ja', name: '일본어' },
      { code: 'zh-Hans', name: '중국어(간체)' },
      { code: 'zh-Hant', name: '중국어(번체)' },
      { code: 'vi', name: '베트남어' },
      { code: 'th', name: '태국어' },
      { code: 'id', name: '인도네시아어' },
      { code: 'ms', name: '말레이어' },
      { code: 'fil', name: '필리핀어' },
      { code: 'km', name: '크메르어' },
      { code: 'lo', name: '라오어' },
      { code: 'my', name: '미얀마어' },
      { code: 'hi', name: '힌디어' },
      { code: 'bn', name: '벵골어' },
      { code: 'ur', name: '우르두어' }
    ];
  }
}

module.exports = AzureTranslator;