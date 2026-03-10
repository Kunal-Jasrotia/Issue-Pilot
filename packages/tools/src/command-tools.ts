import { spawn } from 'node:child_process';
import type { ToolContext, ToolResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT = 50_000; // chars

const BLOCKED_COMMANDS = [
  /^rm\s+-rf\s+\//,
  /^sudo/,
  /^chmod\s+777/,
  /curl.*\|\s*sh/,
  /wget.*\|\s*sh/,
  />\s*\/etc\//,
  />\s*\/usr\//,
  />\s*\/bin\//,
];

function isSafeCommand(command: string): boolean {
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) return false;
  }
  return true;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCommand(
  args: { command: string; cwd?: string },
  ctx: ToolContext
): Promise<ToolResult<RunCommandResult>> {
  if (!isSafeCommand(args.command)) {
    return { success: false, error: `Command blocked for security reasons: ${args.command}` };
  }

  const allowedPatterns = ctx.allowedCommands;
  if (allowedPatterns && allowedPatterns.length > 0) {
    const allowed = allowedPatterns.some((p) => new RegExp(p).test(args.command));
    if (!allowed) {
      return {
        success: false,
        error: `Command not in allowlist: ${args.command}`,
      };
    }
  }

  const timeout = ctx.commandTimeout ?? DEFAULT_TIMEOUT_MS;
  const cwd = args.cwd ? `${ctx.repoPath}/${args.cwd}` : ctx.repoPath;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn('sh', ['-c', args.command], {
      cwd,
      env: {
        ...process.env,
        // Prevent interactive prompts
        CI: 'true',
        TERM: 'dumb',
      },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > DEFAULT_MAX_OUTPUT) {
        stdout = stdout.slice(0, DEFAULT_MAX_OUTPUT) + '\n[... output truncated ...]';
        child.kill('SIGKILL');
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          success: false,
          error: `Command timed out after ${timeout}ms`,
          data: { stdout, stderr, exitCode: -1 },
        });
      } else {
        resolve({
          success: code === 0,
          data: { stdout, stderr, exitCode: code ?? -1 },
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
  });
}
