#!/usr/bin/env node
/**
 * Build all packages in correct dependency order.
 * Faster than `turbo build` for initial builds since it's sequential
 * and avoids cache invalidation issues.
 *
 * Usage:
 *   node scripts/build-packages.js           — build all (skip web)
 *   node scripts/build-packages.js --all     — build everything including web
 *   node scripts/build-packages.js llm tools — build specific packages
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

const BUILD_ORDER = [
  { name: 'llm',     filter: '@issuepilot/llm'     },
  { name: 'tools',   filter: '@issuepilot/tools'   },
  { name: 'github',  filter: '@issuepilot/github'  },
  { name: 'vector',  filter: '@issuepilot/vector'  },
  { name: 'sandbox', filter: '@issuepilot/sandbox' },
  { name: 'agent',   filter: '@issuepilot/agent'   },
  { name: 'api',     filter: '@issuepilot/api'     },
  { name: 'cli',     filter: 'issuepilot'          },
  { name: 'web',     filter: '@issuepilot/web', optional: true },
];

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const includeAll = process.argv.includes('--all');

const targets = args.length > 0
  ? BUILD_ORDER.filter((p) => args.includes(p.name))
  : BUILD_ORDER.filter((p) => !p.optional || includeAll);

if (targets.length === 0) {
  console.error('No matching packages found. Available: ' + BUILD_ORDER.map((p) => p.name).join(', '));
  process.exit(1);
}

console.log(`\n${c.bold}${c.cyan}Building IssuePilot packages${c.reset}\n`);

let failed = 0;
const startAll = Date.now();

for (const pkg of targets) {
  const start = Date.now();
  process.stdout.write(`  ${c.cyan}${pkg.name.padEnd(10)}${c.reset} `);

  const result = spawnSync(`pnpm --filter ${pkg.filter} build`, {
    shell: true, cwd: ROOT, stdio: 'pipe',
  });

  const elapsed = Date.now() - start;

  if (result.status === 0) {
    console.log(`${c.green}✔${c.reset}  ${c.gray}${elapsed}ms${c.reset}`);
  } else {
    console.log(`${c.red}✘  FAILED${c.reset} ${c.gray}(${elapsed}ms)${c.reset}`);
    console.log(result.stderr.toString());
    if (!pkg.optional) failed++;
  }
}

const total = Date.now() - startAll;
console.log(`\n${c.gray}Total: ${total}ms${c.reset}`);

if (failed > 0) {
  console.log(`\n${c.red}${failed} package(s) failed to build.${c.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${c.green}All packages built successfully.${c.reset}\n`);
}
