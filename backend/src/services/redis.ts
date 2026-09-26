import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config';

export const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // BullMQ requirement
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

export const redisConnection = new Redis(redisOptions);

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
