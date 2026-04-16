const Redis = require('ioredis')

const redisUrl = process.env.REDIS_URL

// Se não há Redis configurado, usa um stub para não bloquear o servidor
if (!redisUrl || redisUrl.includes('localhost')) {
  console.log('⚠️  Redis não configurado — usando stub em memória')
  module.exports = {
    zadd: async () => null,
    zincrby: async () => null,
    zrevrange: async () => [],
    zscore: async () => null,
    zrank: async () => null,
    zcard: async () => null,
    get: async () => null,
    set: async () => null,
    del: async () => null,
    expire: async () => null,
    ttl: async () => -1,
    exists: async () => 0,
    incr: async () => null,
    lpush: async () => null,
    lrange: async () => [],
    publish: async () => null,
    subscribe: async () => null,
  }
} else {
  const redis = new Redis(redisUrl, {
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 1000, 30000),
    lazyConnect: true,
  })
  redis.on('connect', () => console.log('✅ Redis conectado'))
  redis.on('error', (err) => console.error('❌ Redis erro:', err.message))
  module.exports = redis
}
