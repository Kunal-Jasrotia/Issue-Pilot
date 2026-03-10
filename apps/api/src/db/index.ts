import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

// Lazy init — Pool and drizzle are created on first DB call, NOT at module load.
// ESM imports are hoisted and evaluated before the calling module's body runs,
// so module-level `new Pool(...)` fires before loadEnv() in index.ts.
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getDb() {
  if (!_db) {
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

// Export a proxy so all existing `db.*` call sites work unchanged
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_t, prop) {
    return getDb()[prop as keyof ReturnType<typeof getDb>];
  },
});
export type DB = ReturnType<typeof getDb>;
export { schema };
