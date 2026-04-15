const Redis = require('ioredis')

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
})

redis.on('connect', () => console.log('✅ Redis conectado'))
redis.on('error', (err) => console.error('❌ Redis erro:', err.message))

module.exports = redis
