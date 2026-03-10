import { Worker, type Job } from 'bullmq';
import path from 'node:path';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { GitHubClient, cloneOrUpdateRepo } from '@issuepilot/github';
import { createProvider } from '@issuepilot/llm';
import { runAgentPipeline } from '@issuepilot/agent';
import type { ProviderName } from '@issuepilot/llm';
import { getBullConnection } from './redis.js';

export interface AgentJobData {
  jobId: string;
  userId: string;
  repositoryId: string;
  issueNumber: number;
}

export function createAgentWorker(): Worker<AgentJobData> {
  const worker = new Worker<AgentJobData>(
    'agent-jobs',
    async (job: Job<AgentJobData>) => {
      const { jobId, userId, repositoryId, issueNumber } = job.data;

      // Mark job as running
      await db
        .update(schema.agentJobs)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(schema.agentJobs.id, jobId));

      // Load repo from DB
      const [repo] = await db
        .select()
        .from(schema.repositories)
        .where(eq(schema.repositories.id, repositoryId))
        .limit(1);

      if (!repo) throw new Error(`Repository ${repositoryId} not found`);

      // Use GITHUB_TOKEN from env
      const accessToken = process.env['GITHUB_TOKEN'];
      if (!accessToken) throw new Error('GITHUB_TOKEN env var is not set');

      // LLM config from env
      const llmApiKey = process.env['OPENAI_API_KEY'] ?? process.env['ANTHROPIC_API_KEY'];
      const llmProvider = (process.env['LLM_PROVIDER'] ?? 'openai') as ProviderName;

      // Setup GitHub client
      const gh = new GitHubClient(accessToken);

      // Fetch issue
      const issue = await gh.getIssue(repo.owner, repo.name, issueNumber);
      const repository = {
        id: repo.githubId,
        fullName: repo.fullName,
        owner: repo.owner,
        name: repo.name,
        defaultBranch: repo.defaultBranch,
        cloneUrl: repo.cloneUrl,
        sshUrl: '',
        private: repo.private,
        language: repo.language ?? null,
        description: repo.description ?? null,
      };

      // Clone/update repository
      await job.updateProgress(5);
      const reposDir = process.env['REPOS_DIR'] ?? path.join(process.cwd(), 'repos');
      const { repoPath } = await cloneOrUpdateRepo({
        accessToken,
        fullName: repo.fullName,
        cloneUrl: repo.cloneUrl,
        reposDir,
      });

      // Create LLM provider
      const provider = createProvider(llmProvider, {
        apiKey: llmApiKey,
        model: process.env['LLM_MODEL'] ?? process.env['OLLAMA_MODEL'] ?? undefined,
        baseUrl: process.env['OLLAMA_BASE_URL'] ?? undefined,
      });

      // Post "working on it" comment to GitHub
      await gh.addIssueComment(
        repo.owner,
        repo.name,
        issueNumber,
        `🤖 **IssuePilot** is working on this issue!\n\nJob ID: \`${jobId}\`\n\nI'll post an update when the pull request is ready.`
      );

      await job.updateProgress(10);

      // Run the agent pipeline
      const result = await runAgentPipeline({
        provider,
        repoPath,
        repository,
        issue,
        githubToken: accessToken,
        maxIterations: 30,
        onProgress: async (event) => {
          // Persist events to DB for SSE streaming
          await db.insert(schema.agentEvents).values({
            jobId,
            type: event.type,
            message: event.message,
            data: (event.data as Record<string, unknown>) ?? null,
          });

          // Update job progress
          const progressMap: Record<string, number> = {
            planning: 20,
            coding: 40,
            testing: 60,
            reviewing: 70,
            fixing: 75,
            committing: 85,
            creating_pr: 95,
          };
          const progress = progressMap[event.type];
          if (progress) await job.updateProgress(progress);
        },
      });

      // Update job record
      await db
        .update(schema.agentJobs)
        .set({
          status: result.success ? 'completed' : 'failed',
          branchName: result.branchName,
          prUrl: result.pullRequest?.htmlUrl,
          prNumber: result.pullRequest?.number,
          error: result.error,
          steps: result.steps,
          completedAt: new Date(),
        })
        .where(eq(schema.agentJobs.id, jobId));

      // Post final comment to GitHub
      if (result.success && result.pullRequest) {
        await gh.addIssueComment(
          repo.owner,
          repo.name,
          issueNumber,
          `✅ **IssuePilot** has created a pull request!\n\n**PR:** ${result.pullRequest.htmlUrl}\n\nPlease review the changes.`
        );
      } else if (!result.success) {
        await gh.addIssueComment(
          repo.owner,
          repo.name,
          issueNumber,
          `❌ **IssuePilot** encountered an error:\n\n\`\`\`\n${result.error ?? 'Unknown error'}\n\`\`\``
        );
      }

      return result;
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      connection: getBullConnection(),
      concurrency: parseInt(process.env['WORKER_CONCURRENCY'] ?? '2'),
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { jobId } = job.data;
    await db
      .update(schema.agentJobs)
      .set({ status: 'failed', error: err.message, completedAt: new Date() })
      .where(eq(schema.agentJobs.id, jobId));
    console.error(`[Worker] Job ${jobId} failed:`, err.message);
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  return worker;
}
