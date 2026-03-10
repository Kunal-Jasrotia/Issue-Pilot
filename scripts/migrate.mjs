#!/usr/bin/env node
/**
 * Run the database migration against a live PostgreSQL instance.
 *
 * Usage:
 *   node scripts/migrate.js                  — uses DATABASE_URL from .env
 *   DATABASE_URL=postgres://... node scripts/migrate.js
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const dbUrl = process.env['DATABASE_URL'];
if (!dbUrl) {
  console.error('DATABASE_URL is not set. Set it in .env or as an environment variable.');
  process.exit(1);
}

const migrationFile = path.join(ROOT, 'apps/api/src/db/migrations/0001_initial.sql');
if (!fs.existsSync(migrationFile)) {
  console.error('Migration file not found:', migrationFile);
  process.exit(1);
}

console.log('  Running migration against:', dbUrl.replace(/:[^:@]+@/, ':***@'));

try {
  execSync(`psql "${dbUrl}" -f "${migrationFile}"`, { stdio: 'inherit' });
  console.log('\n  ✔  Migration complete\n');
} catch {
  // psql not found — try via Docker
  console.log('  psql not found in PATH, trying via Docker...');
  try {
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    execSync(
      `docker compose -f docker/docker-compose.yml exec -T postgres psql -U issuepilot -d issuepilot`,
      { input: sql, cwd: ROOT, stdio: ['pipe', 'inherit', 'inherit'] }
    );
    console.log('\n  ✔  Migration complete (via Docker)\n');
  } catch (e2) {
    console.error('\n  ✘  Migration failed. Make sure PostgreSQL is running and accessible.\n');
    console.error('  You can run the migration manually:');
    console.error(`  psql "$DATABASE_URL" -f apps/api/src/db/migrations/0001_initial.sql\n`);
    process.exit(1);
  }
}
