const {Translate} = require('@google-cloud/translate').v2;
require('dotenv').config();

class GoogleTranslator {
  constructor() {
    this.client = null;
    this.isAvailable = false;
    this.initializeClient();
  }

  initializeClient() {
    try {
      // Google Cloud 인증 설정
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (credentials) {
        this.client = new Translate({
          keyFilename: credentials
        });
        this.isAvailable = true;
        console.log('✅ Google Translate 서비스 초기화 완료');
      } else {
        console.log('⚠️ Google Translate 설정 없음 - GOOGLE_APPLICATION_CREDENTIALS 필요');
      }
    } catch (error) {
      console.error('❌ Google Translate 초기화 실패:', error.message);
      this.isAvailable = false;
    }
  }

  /**
   * 텍스트 번역
   * @param {string} text - 번역할 텍스트
   * @param {string} targetLanguage - 대상 언어 코드
   * @param {string} sourceLanguage - 원본 언어 코드 (optional)
   * @returns {Object} 번역 결과
   */
  async translate(text, targetLanguage, sourceLanguage = null) {
    if (!this.isAvailable) {
      throw new Error('Google Translate 서비스를 사용할 수 없습니다.');
    }

    try {
      const options = {
        to: this.normalizeLanguageCode(targetLanguage),
        model: 'base' // 'base' 또는 'nmt' (Neural Machine Translation)
      };

      // 원본 언어가 지정된 경우
      if (sourceLanguage && sourceLanguage !== 'auto') {
        options.from = this.normalizeLanguageCode(sourceLanguage);
      }

      console.log('🌐 Google Translate 요청:', {
        textLength: text.length,
        to: options.to,
        from: options.from || 'auto-detect'
      });

      // Google Translate API 호출
      const [translation] = await this.client.translate(text, options);
      
      // 언어 감지 (sourceLanguage가 지정되지 않은 경우)
      let detectedLanguage = sourceLanguage;
      if (!sourceLanguage || sourceLanguage === 'auto') {
        const [detections] = await this.client.detect(text);
        detectedLanguage = Array.isArray(detections) 
          ? detections[0].language 
          : detections.language;
      }

      const result = {
        translatedText: translation,
        sourceLanguage: detectedLanguage,
        targetLanguage: targetLanguage,
        characterCount: text.length,
        service: 'google'
      };

      console.log('✅ Google Translate 성공:', {
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        characterCount: result.characterCount
      });

      return result;
    } catch (error) {
      console.error('❌ Google Translate 오류:', error);
      
      // 에러 타입 분석
      if (error.code === 403) {
        throw new Error('Google Translate API 권한 오류 - API 키 또는 할당량 확인 필요');
      } else if (error.code === 429) {
        throw new Error('Google Translate API 요청 제한 초과');
      } else {
        throw new Error(`Google Translate 오류: ${error.message}`);
      }
    }
  }

  /**
   * 언어 코드 정규화 (Azure와 Google 간 차이 처리)
   * @param {string} code - 언어 코드
   * @returns {string} 정규화된 언어 코드
   */
  normalizeLanguageCode(code) {
    const mapping = {
      'zh-Hans': 'zh-CN',  // 중국어 간체
      'zh-Hant': 'zh-TW',  // 중국어 번체
      'ko': 'ko',          // 한국어
      'ja': 'ja',          // 일본어
      'en': 'en',          // 영어
      'vi': 'vi',          // 베트남어
      'th': 'th',          // 태국어
      'id': 'id',          // 인도네시아어
      'ms': 'ms',          // 말레이어
      'fil': 'tl',         // 필리핀어 (타갈로그어)
      'km': 'km',          // 크메르어
      'lo': 'lo',          // 라오어
      'my': 'my',          // 미얀마어
      'hi': 'hi',          // 힌디어
      'bn': 'bn',          // 벵골어
      'ur': 'ur'           // 우르두어
    };

    return mapping[code] || code;
  }

  /**
   * 서비스 상태 확인
   * @returns {Object} 서비스 상태 정보
   */
  async checkHealth() {
    const health = {
      service: 'google',
      available: this.isAvailable,
      configured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
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
      }
    } else {
      health.status = 'not_configured';
    }

    return health;
  }

  /**
   * 지원 언어 목록 가져오기
   * @returns {Array} 지원 언어 목록
   */
  async getSupportedLanguages() {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const [languages] = await this.client.getLanguages();
      return languages.map(lang => ({
        code: lang.code,
        name: lang.name
      }));
    } catch (error) {
      console.error('언어 목록 가져오기 실패:', error);
      return [];
    }
  }
}

module.exports = GoogleTranslator;