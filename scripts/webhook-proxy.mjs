#!/usr/bin/env node
/**
 * Webhook proxy for local development using smee.io.
 *
 * Forwards GitHub webhook events from a fixed smee.io URL to your local API
 * so you never have to update the GitHub webhook URL between restarts.
 *
 * Usage:
 *   1. Visit https://smee.io/new  →  copy the channel URL
 *   2. Set WEBHOOK_PROXY_URL=https://smee.io/yourChannelId in .env
 *   3. Set that same URL as the Payload URL in your GitHub webhook settings
 *   4. Run:  pnpm run webhook:dev
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// ── Load .env ────────────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ── Config ───────────────────────────────────────────────────────────────────
const WEBHOOK_PROXY_URL = process.env['WEBHOOK_PROXY_URL'];
const API_PORT = process.env['PORT'] ?? '3001';
const LOCAL_TARGET = `http://localhost:${API_PORT}/webhooks/github`;

if (!WEBHOOK_PROXY_URL) {
  console.error('\n  ERROR: WEBHOOK_PROXY_URL is not set.\n');
  console.error('  Steps to fix:');
  console.error('    1. Visit https://smee.io/new');
  console.error('    2. Copy the generated channel URL');
  console.error('    3. Add it to your .env:');
  console.error('       WEBHOOK_PROXY_URL=https://smee.io/yourChannelId');
  console.error('    4. Use that same URL as the GitHub webhook Payload URL');
  console.error('       (you only need to do this once — the URL never changes)\n');
  process.exit(1);
}

// ── Import smee-client (ESM) ─────────────────────────────────────────────────
let SmeeClient;
try {
  const mod = await import('smee-client');
  SmeeClient = mod.default;
} catch {
  // Fallback: try require (in case older version is installed)
  try {
    const require = createRequire(import.meta.url);
    SmeeClient = require('smee-client');
  } catch {
    console.error('\n  ERROR: smee-client is not installed.\n');
    console.error('  Run:  pnpm install\n');
    process.exit(1);
  }
}

// ── Start proxy ──────────────────────────────────────────────────────────────
const smee = new SmeeClient({
  source: WEBHOOK_PROXY_URL,
  target: LOCAL_TARGET,
  logger: {
    info:  (...args) => console.log(' [smee]', ...args),
    error: (...args) => console.error('[smee]', ...args),
  },
});

console.log('\n  Webhook proxy started\n');
console.log(`  Smee URL   : ${WEBHOOK_PROXY_URL}`);
console.log(`  Forwarding → ${LOCAL_TARGET}`);
console.log('\n  Set this as your GitHub webhook Payload URL (permanent — never changes).');
console.log('  Press Ctrl+C to stop.\n');

const events = smee.start();

process.on('SIGINT', () => {
  events.close();
  process.exit(0);
});
