import { Redis } from 'ioredis';

let connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

/**
 * BullMQ Queue and Worker accept an ioredis instance directly as `connection`.
 * We cast to `any` here to satisfy BullMQ's ConnectionOptions type,
 * which doesn't expose the ioredis overload in its TypeScript types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBullConnection(): any {
  return getRedisConnection();
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
