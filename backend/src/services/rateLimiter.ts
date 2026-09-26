import { redisConnection } from './redis';

const CHECK_AND_INCR_LUA = `
local current = redis.call('get', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return "limit_hit"
else
  redis.call('incr', KEYS[1])
  redis.call('expire', KEYS[1], 3600)
  return "ok"
end
`;

const DECREMENT_LUA = `
local current = redis.call('get', KEYS[1])
if current and tonumber(current) > 0 then
  redis.call('decr', KEYS[1])
end
return "ok"
`;

export function getHourlyRateLimitInfo(senderId: string, now = new Date()): {
  key: string;
  hourString: string;
  nextHourStart: Date;
} {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');

  const hourString = `${year}-${month}-${day}T${hour}`;
  const key = `ratelimit:${senderId}:${hourString}`;

  const nextHourStart = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 0, 0));

  return { key, hourString, nextHourStart };
}

export async function checkAndIncrementRateLimit(
  senderId: string,
  maxEmailsPerHour: number,
  now = new Date()
): Promise<{ allowed: boolean; nextHourStart: Date; hourString: string }> {
  const { key, hourString, nextHourStart } = getHourlyRateLimitInfo(senderId, now);

  const result = await redisConnection.eval(
    CHECK_AND_INCR_LUA,
    1,
    key,
    maxEmailsPerHour.toString()
  );

  return {
    allowed: result === 'ok',
    nextHourStart,
    hourString,
  };
}

export async function decrementRateLimit(senderId: string, now = new Date()): Promise<void> {
  const { key } = getHourlyRateLimitInfo(senderId, now);
  try {
    await redisConnection.eval(DECREMENT_LUA, 1, key);
  } catch (error: any) {
    console.error(`[RateLimiter] Failed to decrement counter for key ${key}:`, error.message);
  }
}
