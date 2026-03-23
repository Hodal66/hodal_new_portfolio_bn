import Redis from 'ioredis';
import { config } from '../config';
import logger from './logger';

/**
 * Singleton Redis connection for High-Performance caching and rate limiting.
 * Supported: Local Redis or Upstash Redis via REDIS_URL.
 */

const redis = new Redis(config.redis.url || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => logger.info('✅ Redis Connection Active'));
redis.on('error', (err) => logger.error('❌ Redis Connection Error:', err));

export default redis;
