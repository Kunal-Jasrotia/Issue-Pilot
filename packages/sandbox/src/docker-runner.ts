import { spawn } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';

export interface SandboxRunOptions {
  /** Absolute path to the repository on the host */
  repoPath: string;
  /** Shell command to run inside the container */
  command: string;
  /** Docker image to use (auto-detected if not provided) */
  image?: string;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** Environment variables to pass in */
  env?: Record<string, string>;
  /** Memory limit (default: 512m) */
  memory?: string;
  /** CPU quota (default: 1.0) */
  cpus?: string;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  containerId?: string;
}

const IMAGE_MAP: Record<string, string> = {
  'package.json': 'node:20-alpine',
  'requirements.txt': 'python:3.12-slim',
  'Cargo.toml': 'rust:1.78-slim',
  'go.mod': 'golang:1.22-alpine',
  'pom.xml': 'maven:3.9-eclipse-temurin-21-alpine',
  'Gemfile': 'ruby:3.3-alpine',
};

async function detectImage(repoPath: string): Promise<string> {
  const fs = await import('node:fs/promises');
  for (const [file, image] of Object.entries(IMAGE_MAP)) {
    try {
      await fs.access(path.join(repoPath, file));
      return image;
    } catch {
      continue;
    }
  }
  return 'ubuntu:22.04';
}

export async function runInSandbox(options: SandboxRunOptions): Promise<SandboxResult> {
  const {
    repoPath,
    command,
    timeout = 5 * 60 * 1000,
    env = {},
    memory = '512m',
    cpus = '1.0',
  } = options;

  const image = options.image ?? (await detectImage(repoPath));
  const containerName = `issuepilot-sandbox-${crypto.randomBytes(8).toString('hex')}`;

  const envArgs: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    envArgs.push('-e', `${key}=${value}`);
  }

  const dockerArgs = [
    'run',
    '--rm',
    '--name', containerName,
    '--network', 'none', // No network access
    '--memory', memory,
    '--cpus', cpus,
    '--security-opt', 'no-new-privileges',
    '--cap-drop', 'ALL',
    '--read-only',
    '--tmpfs', '/tmp:size=100m',
    '--tmpfs', '/root:size=50m',
    '-v', `${repoPath}:/workspace:rw`,
    '-w', '/workspace',
    ...envArgs,
    image,
    'sh', '-c', command,
  ];

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('docker', dockerArgs, { stdio: 'pipe' });

    const timer = setTimeout(async () => {
      timedOut = true;
      // Force remove container
      spawn('docker', ['kill', containerName]).unref();
      child.kill('SIGKILL');
    }, timeout);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > 100_000) {
        stdout = stdout.slice(0, 100_000) + '\n[...output truncated...]';
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? -1,
        timedOut,
        containerId: containerName,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: `${stderr}\nDocker spawn error: ${err.message}`,
        exitCode: -1,
        timedOut: false,
      });
    });
  });
}

export async function isDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['info'], { stdio: 'ignore' });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}
