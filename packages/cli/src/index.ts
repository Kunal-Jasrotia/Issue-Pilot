#!/usr/bin/env node
/**
 * IssuePilot CLI
 *
 * Usage:
 *   npx issuepilot solve <owner/repo> <issue-number>
 *   npx issuepilot solve <owner/repo> <issue-number> --provider openai --model gpt-4o
 */
import 'dotenv/config';
import path from 'node:path';
import os from 'node:os';
import { GitHubClient, cloneOrUpdateRepo } from '@issuepilot/github';
import { createProvider } from '@issuepilot/llm';
import { runAgentPipeline } from '@issuepilot/agent';
import type { ProviderName } from '@issuepilot/llm';

const COMMANDS = ['solve', 'help', '--help', '-h', '--version', '-v'] as const;

function printHelp() {
  console.log(`
  IssuePilot — AI-powered GitHub issue resolver

  USAGE
    npx issuepilot solve <owner/repo> <issue-number> [options]

  EXAMPLES
    npx issuepilot solve facebook/react 12345
    npx issuepilot solve myorg/myrepo 42 --provider claude --model claude-sonnet-4-6
    npx issuepilot solve myorg/myrepo 42 --provider ollama --model llama3.1

  OPTIONS
    --provider  LLM provider: openai | claude | ollama  (default: openai)
    --model     Model name (uses provider default if omitted)
    --api-key   LLM API key (or set OPENAI_API_KEY / ANTHROPIC_API_KEY env vars)
    --base-url  Custom base URL (for Ollama or OpenAI-compatible APIs)
    --token     GitHub personal access token (or set GITHUB_TOKEN env var)
    --repos-dir Directory to clone repos into (default: ~/.issuepilot/repos)

  ENVIRONMENT VARIABLES
    GITHUB_TOKEN        GitHub personal access token (requires repo scope)
    OPENAI_API_KEY      OpenAI API key
    ANTHROPIC_API_KEY   Anthropic API key
    LLM_PROVIDER        Default LLM provider
    LLM_MODEL           Default model
    OLLAMA_BASE_URL     Ollama server URL (default: http://localhost:11434)
`);
}

function parseArgs(argv: string[]): {
  command: string;
  repoFullName?: string;
  issueNumber?: number;
  flags: Record<string, string>;
} {
  const args = argv.slice(2);
  const command = args[0] ?? 'help';
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg !== undefined && arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = 'true';
        i++;
      }
    } else {
      if (arg !== undefined) positional.push(arg);
      i++;
    }
  }

  return {
    command,
    repoFullName: positional[0],
    issueNumber: positional[1] ? parseInt(positional[1]) : undefined,
    flags,
  };
}

async function solve(
  repoFullName: string,
  issueNumber: number,
  flags: Record<string, string>
): Promise<void> {
  const githubToken = flags['token'] ?? process.env['GITHUB_TOKEN'];
  if (!githubToken) {
    console.error('❌ GitHub token required. Set GITHUB_TOKEN env var or pass --token');
    process.exit(1);
  }

  const providerName = (flags['provider'] ?? process.env['LLM_PROVIDER'] ?? 'openai') as ProviderName;
  const modelOverride = flags['model'] ?? process.env['LLM_MODEL'];
  const apiKey = flags['api-key'] ?? process.env['OPENAI_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'] ?? process.env['LLM_API_KEY'];
  const baseUrl = flags['base-url'] ?? process.env['OLLAMA_BASE_URL'] ?? process.env['LLM_BASE_URL'];
  const reposDir = flags['repos-dir'] ?? path.join(os.homedir(), '.issuepilot', 'repos');

  const [owner, repoName] = repoFullName.split('/');
  if (!owner || !repoName) {
    console.error('❌ Invalid repository format. Use: owner/repo');
    process.exit(1);
  }

  console.log(`\n🚀 IssuePilot — solving issue #${issueNumber} in ${repoFullName}\n`);
  console.log(`   Provider: ${providerName}${modelOverride ? ` (${modelOverride})` : ''}`);

  // Create provider
  let provider;
  try {
    provider = createProvider(providerName, {
      apiKey,
      model: modelOverride,
      baseUrl,
    });
  } catch (err) {
    console.error(`❌ Failed to create LLM provider: ${String(err)}`);
    process.exit(1);
  }

  // Fetch issue and repo
  const gh = new GitHubClient(githubToken);
  let issue, repository;
  try {
    console.log('📡 Fetching issue from GitHub...');
    [issue, repository] = await Promise.all([
      gh.getIssue(owner, repoName, issueNumber),
      gh.getRepository(owner, repoName),
    ]);
    console.log(`   ✅ Issue: "${issue.title}"`);
  } catch (err) {
    console.error(`❌ GitHub error: ${String(err)}`);
    process.exit(1);
  }

  // Clone repo
  console.log('\n📥 Cloning repository...');
  let repoPath: string;
  try {
    const cloneResult = await cloneOrUpdateRepo({
      accessToken: githubToken,
      fullName: repoFullName,
      cloneUrl: repository.cloneUrl,
      reposDir,
    });
    repoPath = cloneResult.repoPath;
    console.log(`   ✅ Repository ready at ${repoPath}`);
  } catch (err) {
    console.error(`❌ Clone error: ${String(err)}`);
    process.exit(1);
  }

  // Run pipeline
  console.log('\n🤖 Starting agent pipeline...\n');
  const startTime = Date.now();

  const result = await runAgentPipeline({
    provider,
    repoPath,
    repository,
    issue,
    githubToken,
    maxIterations: 30,
    onProgress: (event) => {
      const icons: Record<string, string> = {
        started: '🚀',
        planning: '📋',
        coding: '💻',
        testing: '🧪',
        reviewing: '🔍',
        fixing: '🔧',
        committing: '📝',
        creating_pr: '🔀',
        completed: '✅',
        failed: '❌',
        log: '  ',
      };
      const icon = icons[event.type] ?? '•';
      if (event.type !== 'log') {
        console.log(`${icon} ${event.message}`);
      }
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '─'.repeat(50));

  if (result.success && result.pullRequest) {
    console.log(`\n✅ Done! (${elapsed}s)\n`);
    console.log(`   Pull Request: ${result.pullRequest.htmlUrl}`);
    console.log(`   Branch:       ${result.branchName}`);
  } else {
    console.log(`\n❌ Agent pipeline failed (${elapsed}s)`);
    if (result.error) console.log(`   Error: ${result.error}`);
  }

  console.log('\n   Steps summary:');
  for (const step of result.steps) {
    console.log(`   ${step.success ? '✅' : '❌'} ${step.name} (${step.duration}ms)`);
  }
  console.log('');
}

async function main() {
  const { command, repoFullName, issueNumber, flags } = parseArgs(process.argv);

  if (command === '--version' || command === '-v') {
    console.log('issuepilot v1.0.0');
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'solve') {
    if (!repoFullName) {
      console.error('❌ Repository name required. Usage: issuepilot solve <owner/repo> <issue>');
      process.exit(1);
    }
    if (!issueNumber || isNaN(issueNumber)) {
      console.error('❌ Issue number required. Usage: issuepilot solve <owner/repo> <issue-number>');
      process.exit(1);
    }
    await solve(repoFullName, issueNumber, flags);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
