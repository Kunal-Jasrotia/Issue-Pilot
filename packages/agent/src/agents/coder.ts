import type { LLMProvider } from '@issuepilot/llm';
import type { GitHubIssue } from '@issuepilot/github';
import type { ToolContext } from '@issuepilot/tools';
import { TOOL_DEFINITIONS } from '@issuepilot/tools';
import { runToolLoop } from '../tool-loop.js';
import type { Plan } from '../types.js';
import type { ToolLoopResult } from '../tool-loop.js';

// Re-export for type access
export type { ToolLoopResult };

export async function runCoderAgent(
  provider: LLMProvider,
  issue: GitHubIssue,
  plan: Plan,
  repoPath: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const toolContext: ToolContext = {
    repoPath,
    commandTimeout: 60_000,
    allowedCommands: [
      'npm.*', 'node.*', 'tsc.*', 'python.*', 'pip.*',
      'cargo.*', 'go .*', 'ls.*', 'find.*', 'grep.*',
    ],
  };

  const codingTools = TOOL_DEFINITIONS.filter((t) =>
    [
      'read_file', 'write_file', 'edit_file', 'list_directory',
      'search_code', 'get_repo_structure', 'run_command',
      'git_status', 'git_diff',
    ].includes(t.name)
  );

  const systemPrompt = `You are an expert software engineer implementing a fix for a GitHub issue.

IMPLEMENTATION PLAN:
${JSON.stringify(plan, null, 2)}

RULES:
1. Follow the plan step by step
2. Read files before editing them — understand context first
3. Make minimal, focused changes that directly address the issue
4. Preserve existing code style, formatting, and conventions
5. Do not refactor unrelated code
6. After making changes, verify with read_file that the file looks correct
7. Use run_command for installing dependencies only if clearly needed
8. When you are done with all changes, respond with "IMPLEMENTATION COMPLETE" followed by a summary of what you changed

IMPORTANT: Only modify files listed in the plan unless absolutely necessary.`;

  const result = await runToolLoop({
    provider,
    systemPrompt,
    initialMessages: [
      {
        role: 'user',
        content: `Implement the fix for GitHub issue #${issue.number}: "${issue.title}"\n\nIssue body:\n${issue.body ?? 'No description'}\n\nFollow the implementation plan and use the tools to make the necessary code changes.`,
      },
    ],
    tools: codingTools,
    toolContext,
    maxIterations: 25,
    onToolCall: (name, args) => {
      onProgress?.(`Tool: ${name}(${JSON.stringify(args).slice(0, 80)}...)`);
    },
    onThinking: (content) => {
      if (content.trim()) onProgress?.(`Agent: ${content.slice(0, 200)}`);
    },
  });

  return result.finalResponse;
}
