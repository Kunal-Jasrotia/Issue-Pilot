import type { LLMProvider } from '@issuepilot/llm';
import type { GitHubIssue, GitHubRepository } from '@issuepilot/github';
import type { ToolContext } from '@issuepilot/tools';
import { TOOL_DEFINITIONS } from '@issuepilot/tools';
import { runToolLoop } from '../tool-loop.js';
import type { Plan } from '../types.js';

export async function runPlannerAgent(
  provider: LLMProvider,
  issue: GitHubIssue,
  repository: GitHubRepository,
  repoPath: string
): Promise<Plan> {
  const toolContext: ToolContext = {
    repoPath,
    commandTimeout: 30_000,
    allowedCommands: ['ls', 'find', 'cat', 'head', 'tail', 'wc', 'grep'],
  };

  const explorationTools = TOOL_DEFINITIONS.filter((t) =>
    ['read_file', 'list_directory', 'search_code', 'get_repo_structure', 'run_command', 'git_log'].includes(t.name)
  );

  const systemPrompt = `You are a senior software engineer analyzing a GitHub issue to create a precise implementation plan.

Your goal is to:
1. Understand the repository structure and codebase
2. Understand exactly what the issue is asking for
3. Create a detailed step-by-step implementation plan

IMPORTANT: Use the provided tools to explore the repository before making your plan.
Start with get_repo_structure to understand the layout, then dive into relevant files.

Respond with a JSON object in this exact format:
{
  "summary": "Brief description of what needs to be done",
  "steps": [
    { "id": 1, "description": "...", "type": "analyze|modify|create|test|verify", "file": "optional/path" }
  ],
  "filesToModify": ["list/of/files/to/change"],
  "filesToCreate": ["list/of/new/files"],
  "testStrategy": "How to verify the fix works"
}`;

  const issueText = [
    `Repository: ${repository.fullName}`,
    `Issue #${issue.number}: ${issue.title}`,
    `\nDescription:\n${issue.body ?? 'No description provided'}`,
    issue.comments.length > 0
      ? `\nComments:\n${issue.comments.map((c) => `@${c.author}: ${c.body}`).join('\n\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await runToolLoop({
    provider,
    systemPrompt,
    initialMessages: [
      {
        role: 'user',
        content: `Analyze this GitHub issue and create an implementation plan:\n\n${issueText}\n\nFirst explore the repository, then provide your plan as JSON.`,
      },
    ],
    tools: explorationTools,
    toolContext,
    maxIterations: 15,
  });

  // Extract JSON from the response
  try {
    const jsonMatch = result.finalResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in planner response');
    return JSON.parse(jsonMatch[0]) as Plan;
  } catch {
    // Fallback plan
    return {
      summary: `Fix: ${issue.title}`,
      steps: [
        { id: 1, description: 'Analyze the issue', type: 'analyze' },
        { id: 2, description: 'Implement the fix', type: 'modify' },
        { id: 3, description: 'Run tests', type: 'test' },
      ],
      filesToModify: [],
      filesToCreate: [],
      testStrategy: 'Run existing test suite',
    };
  }
}
