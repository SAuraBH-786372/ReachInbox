import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';

// Render managed Redis provides a REDIS_URL; prefer it if set
export const REDIS_URL = process.env.REDIS_URL;

export const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  tls: config.redis.tls,            // Only used for host/port fallback
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

export function createRedisConnection(): Redis {
  return REDIS_URL 
    ? new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false })
    : new Redis(redisOptions);
}

// Use connection string if available (ioredis handles TLS automatically if rediss://)
export const redisConnection = createRedisConnection();

redisConnection.on('error', (err) => {
  console.error('[Redis] Connection Error:', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

export async function checkRedisHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
  try {
    const response = await redisConnection.ping();
    if (response === 'PONG') {
      return { status: 'healthy' };
    }
    return { status: 'unhealthy', error: `Unexpected ping response: ${response}` };
  } catch (error: any) {
    return { status: 'unhealthy', error: error?.message || 'Failed to ping Redis' };
  }
}
