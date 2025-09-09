// Vercel Serverless Function Entry Point
const express = require('express');
const cors = require('cors');
const translationService = require('../server/translationService');

const app = express();

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
    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vercel Serverless Function Export
module.exports = app;