import type { LLMProvider } from '@issuepilot/llm';
import type { ToolContext } from '@issuepilot/tools';
import { TOOL_DEFINITIONS } from '@issuepilot/tools';
import { runToolLoop } from '../tool-loop.js';
import type { ReviewIssue } from './reviewer.js';

export async function runFixAgent(
  provider: LLMProvider,
  repoPath: string,
  testOutput: string,
  reviewIssues: ReviewIssue[],
  onProgress?: (msg: string) => void
): Promise<string> {
  const toolContext: ToolContext = {
    repoPath,
    commandTimeout: 60_000,
    allowedCommands: ['npm.*', 'node.*', 'tsc.*', 'python.*', 'cargo.*', 'go .*'],
  };

  const fixTools = TOOL_DEFINITIONS.filter((t) =>
    [
      'read_file', 'write_file', 'edit_file', 'search_code',
      'run_command', 'git_diff', 'git_status',
    ].includes(t.name)
  );

  const errorSummary = [
    testOutput ? `Test Failures:\n${testOutput}` : '',
    reviewIssues.length > 0
      ? `Review Issues:\n${reviewIssues.map((i) => `[${i.severity}] ${i.file ? `${i.file}: ` : ''}${i.description}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = `You are a software engineer fixing test failures and code review issues.

ERRORS TO FIX:
${errorSummary}

RULES:
1. Read the failing files first to understand the current state
2. Make targeted fixes for each error
3. Do not introduce new changes beyond what is needed to fix the errors
4. After fixing, respond with "FIXES COMPLETE" and a summary`;

  const result = await runToolLoop({
    provider,
    systemPrompt,
    initialMessages: [
      {
        role: 'user',
        content: `Fix the following test failures and review issues. Use the tools to read files and apply targeted fixes.\n\n${errorSummary}`,
      },
    ],
    tools: fixTools,
    toolContext,
    maxIterations: 15,
    onToolCall: (name, args) => {
      onProgress?.(`Fix: ${name}(${JSON.stringify(args).slice(0, 80)}...)`);
    },
  });

  return result.finalResponse;
}
