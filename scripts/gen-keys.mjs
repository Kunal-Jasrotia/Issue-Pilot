#!/usr/bin/env node
/**
 * Generate secure keys for IssuePilot's .env file.
 *
 * Usage:  node scripts/gen-keys.js
 *         node scripts/gen-keys.js --write   (writes values into .env)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

const encryptionKey = crypto.randomBytes(32).toString('hex');
const webhookSecret = crypto.randomBytes(24).toString('base64url');

console.log('\n  Generated secure keys for IssuePilot:\n');
console.log(`  ENCRYPTION_KEY=${encryptionKey}`);
console.log(`  WEBHOOK_SECRET=${webhookSecret}`);
console.log();

if (WRITE) {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('  .env not found — run setup first: node scripts/setup.js');
    process.exit(1);
  }

  let env = fs.readFileSync(envPath, 'utf-8');

  const replacements = [
    ['ENCRYPTION_KEY', encryptionKey],
    ['WEBHOOK_SECRET', webhookSecret],
  ];

  for (const [key, value] of replacements) {
    const regex = new RegExp(`^(${key}=).*$`, 'm');
    if (regex.test(env)) {
      env = env.replace(regex, `$1${value}`);
    }
  }

  fs.writeFileSync(envPath, env);
  console.log('  ✔  Keys written to .env\n');
} else {
  console.log('  Copy these into your .env file.');
  console.log('  Or run with --write to auto-inject them:\n');
  console.log('  node scripts/gen-keys.js --write\n');
}
