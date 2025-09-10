const AzureTranslator = require('./services/azureTranslator');
const GoogleTranslator = require('./services/googleTranslator');
const UsageTracker = require('./services/usageTracker');
require('dotenv').config();

class TranslationService {
  constructor() {
    this.azureTranslator = new AzureTranslator();
    this.googleTranslator = new GoogleTranslator();
    this.usageTracker = new UsageTracker();
    this.primaryService = process.env.PRIMARY_SERVICE || 'azure';
    this.fallbackService = process.env.FALLBACK_SERVICE || 'google';
    this.usageTrackingEnabled = process.env.USAGE_TRACKING !== 'false';
  }

  /**
   * 텍스트 번역 (자동 폴백 포함)
   * @param {string} text - 번역할 텍스트
   * @param {string} targetLanguage - 대상 언어 코드
   * @param {string} sourceLanguage - 원본 언어 코드 (기본값: 'auto')
   * @returns {Object} 번역 결과
   */
  async translate(text, targetLanguage, sourceLanguage = 'auto') {
    // 빈 텍스트 체크
    if (!text || !text.trim()) {
      throw new Error('번역할 텍스트가 비어있습니다.');
    }

    // 추천 서비스 결정 및 사용 가능성 체크
    let recommendedService = this.primaryService;
    if (this.usageTrackingEnabled) {
      try {
        recommendedService = await this.usageTracker.getRecommendedService();
      } catch (error) {
        // 모든 서비스 한도 초과
        console.error('❌ 서비스 한도 초과:', error.message);
        throw new Error(
          `번역 서비스 사용 불가: ${error.message}\n` +
          `한도가 리셋될 때까지 기다려주세요.`
        );
      }

      // 추가 안전장치: 선택된 서비스 사용 가능성 재확인
      const isAvailable = await this.usageTracker.isServiceAvailable(recommendedService);
      if (!isAvailable) {
        console.error(`❌ ${recommendedService.toUpperCase()} 서비스 한도 초과`);
        
        // 대체 서비스 시도
        const fallbackService = recommendedService === 'azure' ? 'google' : 'azure';
        const fallbackAvailable = await this.usageTracker.isServiceAvailable(fallbackService);
        
        if (fallbackAvailable) {
          console.log(`🔄 ${fallbackService.toUpperCase()}로 전환`);
          recommendedService = fallbackService;
        } else {
          throw new Error(
            `모든 번역 서비스 한도 초과\n` +
            `Azure와 Google 모두 사용량 한도에 도달했습니다.\n` +
            `다음 달 1일에 자동으로 리셋됩니다.`
          );
        }
      }
    }

    console.log(`🎯 번역 서비스 선택: ${recommendedService.toUpperCase()}`);

    // 첫 번째 시도: 추천 서비스
    try {
      const result = await this.translateWithService(
        recommendedService,
        text,
        targetLanguage,
        sourceLanguage
      );

      // 사용량 기록
      if (this.usageTrackingEnabled) {
        await this.usageTracker.recordUsage(recommendedService, text.length);
      }

      return result;
    } catch (primaryError) {
      console.error(`❌ ${recommendedService.toUpperCase()} 번역 실패:`, primaryError.message);

      // 폴백 서비스 결정
      const fallbackService = recommendedService === 'azure' ? 'google' : 'azure';
      console.log(`🔄 폴백 서비스로 전환: ${fallbackService.toUpperCase()}`);

      // 두 번째 시도: 폴백 서비스
      try {
        const result = await this.translateWithService(
          fallbackService,
          text,
          targetLanguage,
          sourceLanguage
        );

        // 사용량 기록
        if (this.usageTrackingEnabled) {
          await this.usageTracker.recordUsage(fallbackService, text.length);
        }

        // 폴백 사용 알림 추가
        result.fallbackUsed = true;
        result.fallbackReason = primaryError.message;

        return result;
      } catch (fallbackError) {
        console.error(`❌ ${fallbackService.toUpperCase()} 번역도 실패:`, fallbackError.message);
        
        // 두 서비스 모두 실패
        throw new Error(
          `번역 서비스를 사용할 수 없습니다.\n` +
          `${recommendedService.toUpperCase()}: ${primaryError.message}\n` +
          `${fallbackService.toUpperCase()}: ${fallbackError.message}`
        );
      }
    }
  }

  /**
   * 특정 서비스로 번역
   * @param {string} service - 서비스명 (azure/google)
   * @param {string} text - 번역할 텍스트
   * @param {string} targetLanguage - 대상 언어 코드
   * @param {string} sourceLanguage - 원본 언어 코드
   * @returns {Object} 번역 결과
   */
  async translateWithService(service, text, targetLanguage, sourceLanguage) {
    if (service === 'azure') {
      return await this.azureTranslator.translate(text, targetLanguage, sourceLanguage);
    } else if (service === 'google') {
      return await this.googleTranslator.translate(text, targetLanguage, sourceLanguage);
    } else {
      throw new Error(`알 수 없는 번역 서비스: ${service}`);
    }
  }

  /**
   * 서비스 상태 확인
   * @returns {Object} 전체 서비스 상태
   */
  async getHealthStatus() {
    const [azureHealth, googleHealth] = await Promise.all([
      this.azureTranslator.checkHealth(),
      this.googleTranslator.checkHealth()
    ]);

    let usage = null;
    if (this.usageTrackingEnabled) {
      usage = await this.usageTracker.getStatistics();
    }

    return {
      services: {
        azure: azureHealth,
        google: googleHealth
      },
      usage: usage,
      configuration: {
        primaryService: this.primaryService,
        fallbackService: this.fallbackService,
        usageTracking: this.usageTrackingEnabled
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 사용량 통계 조회
   * @returns {Object} 사용량 통계
   */
  async getUsageStatistics() {
    if (!this.usageTrackingEnabled) {
      return { message: '사용량 추적이 비활성화되어 있습니다.' };
    }
    return await this.usageTracker.getStatistics();
  }

  /**
   * 지원 언어 목록 조회
   * @returns {Object} 각 서비스별 지원 언어
   */
  async getSupportedLanguages() {
    const azureLanguages = this.azureTranslator.getSupportedLanguages();
    const googleLanguages = await this.googleTranslator.getSupportedLanguages();

    return {
      azure: azureLanguages,
      google: googleLanguages,
      common: this.getCommonLanguages(azureLanguages, googleLanguages)
    };
  }

  /**
   * 공통 지원 언어 추출
   * @param {Array} azureLanguages - Azure 지원 언어
   * @param {Array} googleLanguages - Google 지원 언어
   * @returns {Array} 공통 언어 목록
   */
  getCommonLanguages(azureLanguages, googleLanguages) {
    const googleCodes = new Set(googleLanguages.map(lang => lang.code));
    return azureLanguages.filter(lang => {
      // Azure 코드를 Google 코드로 변환해서 비교
      const googleCode = this.convertLanguageCode(lang.code, 'google');
      return googleCodes.has(googleCode);
    });
  }

  /**
   * 언어 코드 변환
   * @param {string} code - 언어 코드
   * @param {string} targetService - 대상 서비스
   * @returns {string} 변환된 언어 코드
   */
  convertLanguageCode(code, targetService) {
    if (targetService === 'google') {
      const mapping = {
        'zh-Hans': 'zh-CN',
        'zh-Hant': 'zh-TW',
        'fil': 'tl'
      };
      return mapping[code] || code;
    }
    return code;
  }
}

// 싱글톤 인스턴스 생성
const translationService = new TranslationService();

// 기존 API와의 호환성을 위한 translate 함수 export
module.exports = {
  translate: (text, targetLanguage, sourceLanguage) => 
    translationService.translate(text, targetLanguage, sourceLanguage),
  getHealthStatus: () => translationService.getHealthStatus(),
  getUsageStatistics: () => translationService.getUsageStatistics(),
  getSupportedLanguages: () => translationService.getSupportedLanguages()
}; 