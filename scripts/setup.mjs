#!/usr/bin/env node
/**
 * IssuePilot Setup Script
 * Cross-platform (Windows, macOS, Linux)
 *
 * Usage:
 *   node scripts/setup.js           — full interactive setup
 *   node scripts/setup.js --ci      — non-interactive (skip prompts, skip optional steps)
 *   node scripts/setup.js --build   — install + build all packages
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IS_WINDOWS = process.platform === 'win32';
const IS_CI = process.argv.includes('--ci');
const DO_BUILD = process.argv.includes('--build');

// ── Colours ───────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const ok = (msg) => console.log(`${c.green}  ✔${c.reset}  ${msg}`);
const info = (msg) => console.log(`${c.cyan}  ℹ${c.reset}  ${msg}`);
const warn = (msg) => console.log(`${c.yellow}  ⚠${c.reset}  ${msg}`);
const err = (msg) => console.log(`${c.red}  ✘${c.reset}  ${msg}`);
const step = (msg) => console.log(`\n${c.bold}${c.cyan}▶ ${msg}${c.reset}`);
const divider = () => console.log(`${c.gray}${'─'.repeat(60)}${c.reset}`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, cwd: ROOT, stdio: 'pipe', ...opts });
}

function runVisible(cmd) {
  return spawnSync(cmd, { shell: true, cwd: ROOT, stdio: 'inherit' });
}

function checkCmd(cmd) {
  const result = run(`${cmd} --version`);
  return result.status === 0;
}

function getVersion(cmd) {
  const result = run(`${cmd} --version`);
  return result.status === 0 ? result.stdout.toString().trim().split('\n')[0] : null;
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════╗
║       IssuePilot Setup               ║
╚══════════════════════════════════════╝${c.reset}\n`);

  const rl = IS_CI ? null : createInterface({ input: process.stdin, output: process.stdout });

  // ── Step 1: Check prerequisites ─────────────────────────────────────────────
  step('Checking prerequisites');

  const nodeVersion = getVersion('node');
  const nodeMajor = parseInt(process.version.replace('v', '').split('.')[0]);
  if (nodeMajor < 20) {
    err(`Node.js 20+ required. Found: ${process.version}`);
    err('Download from: https://nodejs.org/');
    process.exit(1);
  }
  ok(`Node.js ${process.version}`);

  const pnpmVersion = getVersion('pnpm');
  if (!pnpmVersion) {
    warn('pnpm not found. Installing...');
    runVisible('npm install -g pnpm@9');
    if (!checkCmd('pnpm')) {
      err('Failed to install pnpm. Run: npm install -g pnpm@9');
      process.exit(1);
    }
  }
  ok(`pnpm ${getVersion('pnpm') ?? '(installed)'}`);

  const dockerAvailable = checkCmd('docker');
  if (dockerAvailable) {
    ok(`Docker ${getVersion('docker') ?? '(available)'}`);
  } else {
    warn('Docker not found — sandbox test execution will fall back to local mode');
    warn('Install Docker Desktop: https://www.docker.com/products/docker-desktop/');
  }

  const gitAvailable = checkCmd('git');
  if (!gitAvailable) {
    err('git is required. Install from: https://git-scm.com/');
    process.exit(1);
  }
  ok(`git ${getVersion('git') ?? '(available)'}`);

  // ── Step 2: Environment file ─────────────────────────────────────────────────
  step('Environment configuration');

  const envPath = path.join(ROOT, '.env');
  const envExamplePath = path.join(ROOT, '.env.example');

  if (fs.existsSync(envPath)) {
    ok('.env already exists — skipping');
  } else {
    fs.copyFileSync(envExamplePath, envPath);
    ok('Created .env from .env.example');

    if (!IS_CI) {
      warn('You must edit .env before starting the application.');
      console.log(`\n  Required values to set in ${c.yellow}.env${c.reset}:\n`);
      const required = [
        ['GITHUB_TOKEN', 'Fine-grained PAT (github.com/settings/tokens?type=beta)'],
        ['ENCRYPTION_KEY', '64 hex characters (run: pnpm run gen-keys)'],
        ['DATABASE_URL', 'PostgreSQL connection string'],
        ['REDIS_URL', 'Redis connection string'],
        ['WEBHOOK_SECRET', 'Secret for GitHub webhook signature verification'],
      ];
      for (const [key, desc] of required) {
        console.log(`  ${c.yellow}${key.padEnd(24)}${c.reset} ${c.gray}# ${desc}${c.reset}`);
      }
      console.log();
    }
  }

  // ── Step 3: Install dependencies ─────────────────────────────────────────────
  step('Installing dependencies');
  info('Running pnpm install (this may take a minute)...');

  const installResult = runVisible('pnpm install');
  if (installResult.status !== 0) {
    err('pnpm install failed');
    process.exit(1);
  }
  ok('All dependencies installed');

  // ── Step 4: Build packages (if requested or confirmed) ───────────────────────
  let shouldBuild = DO_BUILD;

  if (!IS_CI && !DO_BUILD) {
    const answer = await ask(
      rl,
      `\n${c.cyan}  ?${c.reset}  Build all packages now? (recommended) [Y/n]: `
    );
    shouldBuild = answer.trim().toLowerCase() !== 'n';
  }

  if (shouldBuild) {
    step('Building all packages');
    info('Building in dependency order: llm → tools → github → vector → sandbox → agent → api/cli');

    const packages = [
      { filter: '@issuepilot/llm', label: 'llm' },
      { filter: '@issuepilot/tools', label: 'tools' },
      { filter: '@issuepilot/github', label: 'github' },
      { filter: '@issuepilot/vector', label: 'vector' },
      { filter: '@issuepilot/sandbox', label: 'sandbox' },
      { filter: '@issuepilot/agent', label: 'agent' },
      { filter: '@issuepilot/api', label: 'api' },
      { filter: 'issuepilot', label: 'cli' },
    ];

    for (const pkg of packages) {
      process.stdout.write(`  Building ${c.cyan}${pkg.label}${c.reset}...`);
      const result = run(`pnpm --filter ${pkg.filter} build`);
      if (result.status !== 0) {
        console.log(` ${c.red}FAILED${c.reset}`);
        err(`Build failed for ${pkg.label}:`);
        console.log(result.stderr.toString());
        process.exit(1);
      }
      console.log(` ${c.green}done${c.reset}`);
    }

    // Web is separate (Next.js build is slow, skip unless explicitly asked)
    if (DO_BUILD) {
      process.stdout.write(`  Building ${c.cyan}web${c.reset}...`);
      const result = run('pnpm --filter @issuepilot/web build');
      if (result.status !== 0) {
        console.log(` ${c.yellow}SKIPPED (needs env vars)${c.reset}`);
      } else {
        console.log(` ${c.green}done${c.reset}`);
      }
    }

    ok('All packages built successfully');
  }

  // ── Step 5: Infrastructure check ─────────────────────────────────────────────
  step('Infrastructure check');

  if (dockerAvailable) {
    const pgResult = run('docker compose -f docker/docker-compose.yml ps postgres 2>&1');
    const pgRunning = pgResult.stdout.toString().includes('running');

    if (pgRunning) {
      ok('PostgreSQL is running');
    } else {
      warn('PostgreSQL is not running');
      if (!IS_CI) {
        const answer = await ask(
          rl,
          `  ${c.cyan}?${c.reset}  Start PostgreSQL, Redis & Qdrant via Docker? [Y/n]: `
        );
        if (answer.trim().toLowerCase() !== 'n') {
          info('Starting infrastructure containers...');
          runVisible('docker compose -f docker/docker-compose.yml up postgres redis qdrant -d');
          ok('Infrastructure started');

          // Wait for postgres to be ready, then run migration
          info('Waiting for PostgreSQL to be ready...');
          let ready = false;
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            const check = run(
              'docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U issuepilot 2>&1'
            );
            if (check.status === 0) {
              ready = true;
              break;
            }
            process.stdout.write('.');
          }
          if (ready) {
            console.log();
            info('Running database migration...');
            const migResult = run(
              'docker compose -f docker/docker-compose.yml exec -T postgres psql -U issuepilot -d issuepilot -f /dev/stdin',
              {
                input: fs.readFileSync(
                  path.join(ROOT, 'apps/api/src/db/migrations/0001_initial.sql')
                ),
              }
            );
            if (migResult.status === 0) {
              ok('Database schema created');
            } else {
              warn('Migration may have already run, or failed — check manually');
            }
          }
        }
      }
    }
  } else {
    warn('Docker not available — start PostgreSQL, Redis, and Qdrant manually');
    info('Then run: node scripts/setup.js --migrate');
  }

  rl?.close();

  // ── Done ──────────────────────────────────────────────────────────────────────
  divider();
  console.log(`\n${c.bold}${c.green}  Setup complete!${c.reset}\n`);
  console.log(`  Next steps:\n`);
  console.log(
    `  ${c.yellow}1.${c.reset} Edit ${c.cyan}.env${c.reset} — set ${c.yellow}GITHUB_TOKEN${c.reset}, LLM keys, and webhook secret`
  );
  console.log(`  ${c.yellow}2.${c.reset} Start dev servers:  ${c.cyan}pnpm dev${c.reset}`);
  console.log(
    `  ${c.yellow}3.${c.reset} Open the app:       ${c.cyan}http://localhost:3000${c.reset}`
  );
  console.log(
    `  ${c.yellow}4.${c.reset} API health check:   ${c.cyan}http://localhost:3001/health${c.reset}\n`
  );
  console.log(`  CLI usage:\n`);
  console.log(`  ${c.gray}# After building, solve an issue directly:${c.reset}`);
  console.log(`  ${c.cyan}npx issuepilot solve owner/repo 42${c.reset}\n`);
}

main().catch((e) => {
  err(`Setup failed: ${e.message}`);
  process.exit(1);
});
