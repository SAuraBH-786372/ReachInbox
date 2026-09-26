import { RedisMemoryServer } from 'redis-memory-server';

async function run() {
  const redisServer = new RedisMemoryServer({
    instance: {
      port: 6379,
    },
  });

  const host = await redisServer.getHost();
  const port = await redisServer.getPort();
  console.log(`[DevRedis] In-memory Redis server running at ${host}:${port}`);

  process.on('SIGINT', async () => {
    await redisServer.stop();
    process.exit(0);
  });
}

run().catch(console.error);
