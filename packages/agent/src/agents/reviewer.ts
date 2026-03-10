import type { LLMProvider } from '@issuepilot/llm';
import type { GitHubIssue } from '@issuepilot/github';
import type { ToolContext } from '@issuepilot/tools';
import { TOOL_DEFINITIONS } from '@issuepilot/tools';
import { runToolLoop } from '../tool-loop.js';
import type { Plan } from '../types.js';

export interface ReviewResult {
  approved: boolean;
  issues: ReviewIssue[];
  summary: string;
}

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'suggestion';
  file?: string;
  description: string;
}

export async function runReviewerAgent(
  provider: LLMProvider,
  issue: GitHubIssue,
  plan: Plan,
  repoPath: string,
  testOutput: string
): Promise<ReviewResult> {
  const toolContext: ToolContext = {
    repoPath,
    commandTimeout: 30_000,
  };

  const reviewTools = TOOL_DEFINITIONS.filter((t) =>
    ['read_file', 'git_diff', 'git_status', 'search_code'].includes(t.name)
  );

  const systemPrompt = `You are a senior code reviewer performing a final review of AI-generated changes.

Your job is to:
1. Review all changed files using git_diff
2. Check that the implementation correctly addresses the issue
3. Look for bugs, security issues, or broken logic
4. Verify that no unrelated code was changed

Test results:
${testOutput}

Respond with a JSON object:
{
  "approved": true/false,
  "issues": [
    { "severity": "error|warning|suggestion", "file": "optional", "description": "..." }
  ],
  "summary": "Brief review summary"
}

Approve if: tests pass, the fix is correct, code quality is good.
Reject if: tests fail, the fix is incorrect, security issues exist.`;

  const result = await runToolLoop({
    provider,
    systemPrompt,
    initialMessages: [
      {
        role: 'user',
        content: `Review the changes made for issue #${issue.number}: "${issue.title}"\n\nPlanned changes:\n${plan.summary}\n\nStart by running git_diff to see what changed.`,
      },
    ],
    tools: reviewTools,
    toolContext,
    maxIterations: 10,
  });

  try {
    const jsonMatch = result.finalResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in review response');
    return JSON.parse(jsonMatch[0]) as ReviewResult;
  } catch {
    return {
      approved: testOutput.toLowerCase().includes('pass') || testOutput.includes('0 failed'),
      issues: [],
      summary: result.finalResponse.slice(0, 500),
    };
  }
}
