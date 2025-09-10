const express = require('express');
const cors = require('cors');
const translationService = require('./translationService');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: '번역기 API 서버가 실행 중입니다.',
    endpoints: {
      translate: 'POST /api/translate',
      health: 'GET /health',
      healthDetail: 'GET /api/health'
    }
  });
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  // 기본 헬스체크
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'translation-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json(healthStatus);
});

// 상세 헬스체크 엔드포인트 (의존성 체크 포함)
app.get('/api/health', async (req, res) => {
  try {
    // 번역 서비스 상태 가져오기
    const serviceHealth = await translationService.getHealthStatus();
    
    // 메모리 사용량 체크
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    // 전체 상태 결정
    let overallStatus = 'healthy';
    
    // Azure 상태 확인
    if (serviceHealth.services.azure.status === 'unhealthy') {
      if (serviceHealth.services.google.status === 'healthy') {
        overallStatus = 'degraded'; // Azure 실패했지만 Google 사용 가능
      } else {
        overallStatus = 'unhealthy'; // 둘 다 실패
      }
    }
    
    // 메모리 체크
    if (heapUsedMB / heapTotalMB > 0.9) {
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    }
    
    // 사용량 한도 체크
    if (serviceHealth.usage) {
      const azureStatus = serviceHealth.usage.azure.status;
      const googleStatus = serviceHealth.usage.google.status;
      
      if (azureStatus === 'exhausted' && googleStatus === 'exhausted') {
        overallStatus = 'unhealthy';
      } else if (azureStatus === 'critical' || googleStatus === 'critical') {
        overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      }
    }
    
    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'translation-api',
      version: '2.0.0', // 버전 업데이트
      environment: process.env.NODE_ENV || 'development',
      memory: {
        heapUsed: `${heapUsedMB} MB`,
        heapTotal: `${heapTotalMB} MB`,
        usage: `${Math.round((heapUsedMB / heapTotalMB) * 100)}%`
      },
      services: serviceHealth.services,
      usage: serviceHealth.usage,
      configuration: serviceHealth.configuration
    };
    
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(healthResponse);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 번역 API 엔드포인트 (핵심 기능)
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    // 입력 검증
    if (!text) {
      return res.status(400).json({ error: '번역할 텍스트가 필요합니다.' });
    }

    if (!targetLanguage) {
      return res.status(400).json({ error: '대상 언어가 필요합니다.' });
    }

    // 번역 서비스 호출
    const result = await translationService.translate(text, targetLanguage, sourceLanguage);
    
    // 폴백 사용 시 헤더에 정보 추가
    if (result.fallbackUsed) {
      res.setHeader('X-Translation-Fallback', 'true');
      res.setHeader('X-Translation-Service', result.service);
    }
    
    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 사용량 통계 엔드포인트
app.get('/api/usage', async (req, res) => {
  try {
    const usage = await translationService.getUsageStatistics();
    res.json(usage);
  } catch (error) {
    console.error('Usage statistics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 지원 언어 목록 엔드포인트
app.get('/api/languages', async (req, res) => {
  try {
    const languages = await translationService.getSupportedLanguages();
    res.json(languages);
  } catch (error) {
    console.error('Languages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 서버 시작 (Vercel에서는 자동으로 처리되므로 로컬 환경에서만 실행)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📝 번역 API: http://localhost:${PORT}/api/translate`);
  });
}

// Vercel 서버리스 함수로 export
module.exports = app; 