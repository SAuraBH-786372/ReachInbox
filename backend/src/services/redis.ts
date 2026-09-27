import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';

// Render managed Redis provides a REDIS_URL; prefer it if set
const REDIS_URL = process.env.REDIS_URL;

export const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  tls: config.redis.tls,            // TLS required by Render Redis in production
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Use connection string if available (Render's REDIS_URL includes auth + TLS)
export const redisConnection = REDIS_URL
  ? new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: config.redis.tls,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
    })
  : new Redis(redisOptions);

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
