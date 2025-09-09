// Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');
const translationService = require('../server/translationService');

const app = express();

// 메트릭 수집을 위한 메모리 스토어
const metrics = {
  requests: {
    total: 0,
    translate: 0,
    health: 0,
    errors: 0
  },
  translations: {
    total: 0,
    byLanguage: {},
    averageLength: 0,
    totalCharacters: 0
  },
  performance: {
    averageResponseTime: 0,
    totalResponseTime: 0,
    requestCount: 0
  },
  lastReset: new Date().toISOString()
};

// 구조화된 로깅 함수
function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'translation-api',
    environment: process.env.NODE_ENV || 'development',
    message,
    ...meta
  };
  
  // Vercel은 console.log를 자동으로 수집
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

// 응답 시간 측정 미들웨어
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // 응답 완료 시 처리
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // 메트릭 업데이트
    metrics.requests.total++;
    metrics.performance.totalResponseTime += duration;
    metrics.performance.requestCount++;
    metrics.performance.averageResponseTime = 
      metrics.performance.totalResponseTime / metrics.performance.requestCount;
    
    // 로깅
    log('info', 'Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });
  });
  
  next();
});

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
      healthDetail: 'GET /api/health',
      metrics: 'GET /api/metrics'
    }
  });
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  metrics.requests.health++;
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'translation-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
  log('info', 'Health check requested', { status: 'healthy' });
  res.status(200).json(healthStatus);
});

// 상세 헬스체크 엔드포인트
app.get('/api/health', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'translation-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      server: 'ok',
      azure_config: 'unknown',
      memory: 'unknown'
    }
  };

  try {
    // Azure 설정 확인
    if (process.env.AZURE_TRANSLATOR_KEY && process.env.AZURE_TRANSLATOR_ENDPOINT) {
      checks.checks.azure_config = 'ok';
    } else {
      checks.checks.azure_config = 'missing';
      checks.status = 'degraded';
    }

    // 메모리 사용량 체크
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    checks.memory = {
      heapUsed: `${heapUsedMB} MB`,
      heapTotal: `${heapTotalMB} MB`,
      usage: `${Math.round((heapUsedMB / heapTotalMB) * 100)}%`
    };
    
    if (heapUsedMB / heapTotalMB > 0.9) {
      checks.checks.memory = 'warning';
      checks.status = 'degraded';
    } else {
      checks.checks.memory = 'ok';
    }

    const statusCode = checks.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);
  } catch (error) {
    console.error('Health check error:', error);
    checks.status = 'unhealthy';
    checks.error = error.message;
    res.status(503).json(checks);
  }
});

// 번역 API 엔드포인트
app.post('/api/translate', async (req, res) => {
  const startTime = Date.now();
  metrics.requests.translate++;
  
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    // 입력 검증
    if (!text) {
      metrics.requests.errors++;
      log('warn', 'Translation request missing text', { targetLanguage, sourceLanguage });
      return res.status(400).json({ error: '번역할 텍스트가 필요합니다.' });
    }

    if (!targetLanguage) {
      metrics.requests.errors++;
      log('warn', 'Translation request missing target language', { text: text.substring(0, 50) });
      return res.status(400).json({ error: '대상 언어가 필요합니다.' });
    }

    // 번역 서비스 호출
    const result = await translationService.translate(text, targetLanguage, sourceLanguage);
    
    // 메트릭 업데이트
    metrics.translations.total++;
    metrics.translations.totalCharacters += text.length;
    metrics.translations.averageLength = 
      metrics.translations.totalCharacters / metrics.translations.total;
    
    // 언어별 카운트
    const langPair = `${sourceLanguage || 'auto'}_to_${targetLanguage}`;
    metrics.translations.byLanguage[langPair] = 
      (metrics.translations.byLanguage[langPair] || 0) + 1;
    
    const duration = Date.now() - startTime;
    log('info', 'Translation completed', {
      sourceLanguage: result.sourceLanguage,
      targetLanguage: result.targetLanguage,
      characterCount: text.length,
      duration
    });
    
    res.json(result);
  } catch (error) {
    metrics.requests.errors++;
    log('error', 'Translation API error', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ error: error.message });
  }
});

// 메트릭 엔드포인트
app.get('/api/metrics', (req, res) => {
  const currentMetrics = {
    ...metrics,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
  
  log('info', 'Metrics requested');
  res.json(currentMetrics);
});

// Vercel Serverless Function Export
module.exports = app;