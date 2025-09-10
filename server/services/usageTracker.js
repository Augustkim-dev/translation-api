const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class UsageTracker {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.usageFile = path.join(this.dataDir, 'usage.json');
    this.limits = {
      azure: {
        monthly: parseInt(process.env.AZURE_MONTHLY_LIMIT || '2000000'),
        daily: parseInt(process.env.AZURE_DAILY_LIMIT || '70000')
      },
      google: {
        monthly: parseInt(process.env.GOOGLE_MONTHLY_LIMIT || '500000'),
        daily: parseInt(process.env.GOOGLE_DAILY_LIMIT || '17000')
      }
    };
    this.initializeDataStore();
  }

  /**
   * 데이터 저장소 초기화
   */
  async initializeDataStore() {
    try {
      // 데이터 디렉토리 생성
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // 사용량 파일이 없으면 생성
      try {
        await fs.access(this.usageFile);
      } catch {
        await this.resetUsageData();
        console.log('📊 사용량 추적 시스템 초기화 완료');
      }
    } catch (error) {
      console.error('❌ 사용량 추적 시스템 초기화 실패:', error);
    }
  }

  /**
   * 사용량 데이터 초기화
   */
  async resetUsageData() {
    const initialData = {
      azure: {
        daily: {},
        monthly: {},
        total: 0,
        lastReset: new Date().toISOString()
      },
      google: {
        daily: {},
        monthly: {},
        total: 0,
        lastReset: new Date().toISOString()
      },
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(this.usageFile, JSON.stringify(initialData, null, 2));
    return initialData;
  }

  /**
   * 사용량 데이터 읽기
   */
  async readUsageData() {
    try {
      const data = await fs.readFile(this.usageFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('사용량 데이터 읽기 실패:', error);
      return await this.resetUsageData();
    }
  }

  /**
   * 사용량 데이터 저장
   */
  async saveUsageData(data) {
    try {
      data.lastUpdated = new Date().toISOString();
      await fs.writeFile(this.usageFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('사용량 데이터 저장 실패:', error);
    }
  }

  /**
   * 번역 사용량 기록
   * @param {string} service - 서비스명 (azure/google)
   * @param {number} characterCount - 문자 수
   */
  async recordUsage(service, characterCount) {
    const data = await this.readUsageData();
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    // 일일 사용량 업데이트
    if (!data[service].daily[today]) {
      data[service].daily[today] = 0;
    }
    data[service].daily[today] += characterCount;

    // 월간 사용량 업데이트
    if (!data[service].monthly[month]) {
      data[service].monthly[month] = 0;
    }
    data[service].monthly[month] += characterCount;

    // 총 사용량 업데이트
    data[service].total += characterCount;

    await this.saveUsageData(data);

    console.log(`📊 ${service.toUpperCase()} 사용량 기록:`, {
      characters: characterCount,
      dailyTotal: data[service].daily[today],
      monthlyTotal: data[service].monthly[month]
    });
  }

  /**
   * 현재 사용량 조회
   * @param {string} service - 서비스명 (azure/google)
   * @returns {Object} 사용량 정보
   */
  async getUsage(service) {
    const data = await this.readUsageData();
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const dailyUsage = data[service].daily[today] || 0;
    const monthlyUsage = data[service].monthly[month] || 0;

    return {
      daily: {
        used: dailyUsage,
        limit: this.limits[service].daily,
        remaining: Math.max(0, this.limits[service].daily - dailyUsage),
        percentage: Math.round((dailyUsage / this.limits[service].daily) * 100)
      },
      monthly: {
        used: monthlyUsage,
        limit: this.limits[service].monthly,
        remaining: Math.max(0, this.limits[service].monthly - monthlyUsage),
        percentage: Math.round((monthlyUsage / this.limits[service].monthly) * 100)
      },
      total: data[service].total
    };
  }

  /**
   * 서비스 사용 가능 여부 확인
   * @param {string} service - 서비스명 (azure/google)
   * @returns {boolean} 사용 가능 여부
   */
  async isServiceAvailable(service) {
    const usage = await this.getUsage(service);
    
    // 일일 한도 또는 월간 한도 초과 확인
    if (usage.daily.remaining <= 0 || usage.monthly.remaining <= 0) {
      console.log(`❌ ${service.toUpperCase()} 사용량 한도 초과 - 서비스 차단`);
      console.log(`  월간: ${usage.monthly.used}/${usage.monthly.limit} (${usage.monthly.percentage}%)`);
      console.log(`  일일: ${usage.daily.used}/${usage.daily.limit} (${usage.daily.percentage}%)`);
      return false;
    }

    // 월간 사용량이 95% 이상이면 강력한 경고
    if (usage.monthly.percentage >= 95) {
      console.log(`🚨 ${service.toUpperCase()} 월간 사용량 ${usage.monthly.percentage}% - 한도 임박! 잔여: ${usage.monthly.remaining}자`);
    } else if (usage.monthly.percentage >= 90) {
      console.log(`⚠️ ${service.toUpperCase()} 월간 사용량 ${usage.monthly.percentage}% - 주의 필요`);
    }

    // 일일 사용량이 90% 이상이면 경고
    if (usage.daily.percentage >= 90) {
      console.log(`⚠️ ${service.toUpperCase()} 일일 사용량 ${usage.daily.percentage}% - 주의 필요`);
    }

    return true;
  }

  /**
   * 최적 서비스 선택
   * @returns {string} 권장 서비스명
   * @throws {Error} 모든 서비스가 한도 초과인 경우
   */
  async getRecommendedService() {
    const azureUsage = await this.getUsage('azure');
    const googleUsage = await this.getUsage('google');

    // Azure 서비스 사용 가능 여부 확인
    const azureAvailable = azureUsage.monthly.percentage < 100 && azureUsage.daily.percentage < 100;
    const googleAvailable = googleUsage.monthly.percentage < 100 && googleUsage.daily.percentage < 100;

    // 두 서비스 모두 한도 초과 시 에러
    if (!azureAvailable && !googleAvailable) {
      throw new Error(
        `모든 번역 서비스 한도 초과\n` +
        `Azure: 월 ${azureUsage.monthly.percentage}%, 일 ${azureUsage.daily.percentage}% 사용\n` +
        `Google: 월 ${googleUsage.monthly.percentage}%, 일 ${googleUsage.daily.percentage}% 사용\n` +
        `다음 달 1일에 리셋됩니다.`
      );
    }

    // Azure 우선순위가 높지만, 사용량이 90% 이상이면 Google 권장
    if (azureAvailable && azureUsage.monthly.percentage < 90 && azureUsage.daily.percentage < 90) {
      return 'azure';
    }

    // Google 사용 가능하면 Google 선택
    if (googleAvailable) {
      // Google도 90% 이상이면 경고
      if (googleUsage.monthly.percentage >= 90 || googleUsage.daily.percentage >= 90) {
        console.log(`⚠️ Google 사용량 주의: 월 ${googleUsage.monthly.percentage}%, 일 ${googleUsage.daily.percentage}%`);
      }
      return 'google';
    }

    // Azure만 사용 가능한 경우 (90% 이상이지만 100% 미만)
    if (azureAvailable) {
      console.log(`⚠️ Azure 사용량 주의: 월 ${azureUsage.monthly.percentage}%, 일 ${azureUsage.daily.percentage}%`);
      return 'azure';
    }

    // 이론적으로 도달하지 않아야 하는 코드
    throw new Error('서비스 선택 오류');
  }

  /**
   * 전체 사용량 통계
   * @returns {Object} 전체 통계
   */
  async getStatistics() {
    const data = await this.readUsageData();
    const azureUsage = await this.getUsage('azure');
    const googleUsage = await this.getUsage('google');

    return {
      azure: {
        ...azureUsage,
        lastReset: data.azure.lastReset,
        status: this.getServiceStatus(azureUsage)
      },
      google: {
        ...googleUsage,
        lastReset: data.google.lastReset,
        status: this.getServiceStatus(googleUsage)
      },
      recommendedService: await this.getRecommendedService(),
      lastUpdated: data.lastUpdated
    };
  }

  /**
   * 서비스 상태 결정
   * @param {Object} usage - 사용량 정보
   * @returns {string} 상태 (healthy/warning/critical/exhausted)
   */
  getServiceStatus(usage) {
    if (usage.monthly.percentage >= 100 || usage.daily.percentage >= 100) {
      return 'exhausted';
    } else if (usage.monthly.percentage >= 90 || usage.daily.percentage >= 90) {
      return 'critical';
    } else if (usage.monthly.percentage >= 75 || usage.daily.percentage >= 75) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * 오래된 일일 데이터 정리 (30일 이상)
   */
  async cleanupOldData() {
    const data = await this.readUsageData();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    for (const service of ['azure', 'google']) {
      const dailyData = data[service].daily;
      for (const date in dailyData) {
        if (date < cutoffDate) {
          delete dailyData[date];
        }
      }
    }

    await this.saveUsageData(data);
  }
}

module.exports = UsageTracker;