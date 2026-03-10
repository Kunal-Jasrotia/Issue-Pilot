import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import {
  verifyWebhookSignature,
  shouldTriggerAgent,
  type WebhookPayload,
} from '@issuepilot/github';
import { enqueueAgentJob } from '../queue/queue.js';

export const webhookRouter = Router();

webhookRouter.post('/github', async (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const event = req.headers['x-github-event'] as string | undefined;

  if (!signature || !event) {
    res.status(400).json({ error: 'Missing GitHub headers' });
    return;
  }

  // Verify signature
  const rawBody = JSON.stringify(req.body);
  if (!verifyWebhookSignature(rawBody, signature, process.env['WEBHOOK_SECRET'] ?? 'change-me')) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const payload = req.body as WebhookPayload;

  // Only handle issues and issue_comment events
  if (event !== 'issues' && event !== 'issue_comment') {
    res.json({ ok: true, skipped: true });
    return;
  }

  if (!shouldTriggerAgent(payload)) {
    res.json({ ok: true, skipped: true });
    return;
  }

  const fullName = payload.repository.full_name;
  const issueNumber = payload.issue?.number;
  const issueTitle = payload.issue?.title ?? 'Unknown';

  if (!issueNumber) {
    res.json({ ok: true, skipped: true });
    return;
  }

  // Find the repository record (and its owner user)
  const [repo] = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.fullName, fullName))
    .limit(1);

  if (!repo) {
    console.warn(`[Webhook] No repository found for ${fullName}`);
    res.json({ ok: true, skipped: true });
    return;
  }

  // Check for duplicate job (don't re-run if already in progress)
  const existingJob = await db
    .select({ id: schema.agentJobs.id, status: schema.agentJobs.status })
    .from(schema.agentJobs)
    .where(
      and(eq(schema.agentJobs.repositoryId, repo.id), eq(schema.agentJobs.issueNumber, issueNumber))
    )
    .limit(1);

  if (existingJob[0] && ['queued', 'running'].includes(existingJob[0].status)) {
    res.json({ ok: true, skipped: true, reason: 'job already running' });
    return;
  }

  // Create and enqueue job
  const [job] = await db
    .insert(schema.agentJobs)
    .values({
      userId: repo.userId,
      repositoryId: repo.id,
      issueNumber,
      issueTitle,
      status: 'queued',
    })
    .returning();

  if (!job) {
    res.status(500).json({ error: 'Failed to create job' });
    return;
  }

  await enqueueAgentJob({
    jobId: job.id,
    userId: repo.userId,
    repositoryId: repo.id,
    issueNumber,
  });

  console.log(`[Webhook] Queued job ${job.id} for ${fullName}#${issueNumber}`);
  res.json({ ok: true, jobId: job.id });
});
