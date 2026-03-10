import path from 'node:path';
import fs from 'node:fs/promises';
import { runInSandbox, isDockerAvailable } from './docker-runner.js';
import type { SandboxResult } from './docker-runner.js';

export interface TestRunOptions {
  repoPath: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface TestRunResult {
  passed: boolean;
  output: string;
  exitCode: number;
  command: string;
  runner: 'docker' | 'local';
}

async function detectTestCommand(repoPath: string): Promise<string> {
  try {
    const pkgJson = JSON.parse(
      await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8')
    ) as { scripts?: Record<string, string> };
    if (pkgJson.scripts?.['test']) return 'npm test';
    if (pkgJson.scripts?.['test:ci']) return 'npm run test:ci';
  } catch {}

  try {
    await fs.access(path.join(repoPath, 'pytest.ini'));
    return 'python -m pytest --tb=short -q';
  } catch {}

  try {
    await fs.access(path.join(repoPath, 'Cargo.toml'));
    return 'cargo test';
  } catch {}

  try {
    await fs.access(path.join(repoPath, 'go.mod'));
    return 'go test ./...';
  } catch {}

  return 'npm test';
}

export async function runTests(options: TestRunOptions): Promise<TestRunResult> {
  const command = await detectTestCommand(options.repoPath);
  const dockerAvailable = await isDockerAvailable();

  if (dockerAvailable) {
    const result = await runInSandbox({
      repoPath: options.repoPath,
      command,
      timeout: options.timeout ?? 10 * 60 * 1000,
      env: options.env,
    });

    return {
      passed: result.exitCode === 0 && !result.timedOut,
      output: formatOutput(result),
      exitCode: result.exitCode,
      command,
      runner: 'docker',
    };
  }

  // Fallback: run locally via child_process (less secure but functional)
  const { spawn } = await import('node:child_process');
  const stdout_parts: string[] = [];
  const stderr_parts: string[] = [];

  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn('sh', ['-c', command], {
      cwd: options.repoPath,
      env: { ...process.env, CI: 'true' },
    });
    child.stdout.on('data', (c: Buffer) => stdout_parts.push(c.toString()));
    child.stderr.on('data', (c: Buffer) => stderr_parts.push(c.toString()));
    child.on('close', (code) => resolve(code ?? -1));
    child.on('error', () => resolve(-1));
    setTimeout(() => { child.kill('SIGKILL'); resolve(-1); }, options.timeout ?? 5 * 60 * 1000);
  });

  return {
    passed: exitCode === 0,
    output: `${stdout_parts.join('')}\n${stderr_parts.join('')}`,
    exitCode,
    command,
    runner: 'local',
  };
}

function formatOutput(result: SandboxResult): string {
  const parts: string[] = [];
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(`STDERR:\n${result.stderr}`);
  if (result.timedOut) parts.push('\n[TEST TIMED OUT]');
  return parts.join('\n');
}
