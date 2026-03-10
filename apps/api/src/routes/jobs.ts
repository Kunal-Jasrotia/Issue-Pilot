import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { SYSTEM_USER_ID } from '../middleware/auth.js';
import { enqueueAgentJob } from '../queue/queue.js';

export const jobsRouter = Router();

// POST /jobs — dispatch an agent job for an issue
const dispatchSchema = z.object({
  repositoryId: z.string().uuid(),
  issueNumber: z.number().int().positive(),
  issueTitle: z.string(),
});

jobsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { repositoryId, issueNumber, issueTitle } = parsed.data;

  // Verify the repo exists
  const [repo] = await db
    .select()
    .from(schema.repositories)
    .where(
      and(eq(schema.repositories.id, repositoryId), eq(schema.repositories.userId, SYSTEM_USER_ID))
    )
    .limit(1);

  if (!repo) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }

  // Create job record
  const [job] = await db
    .insert(schema.agentJobs)
    .values({
      userId: SYSTEM_USER_ID,
      repositoryId,
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
    userId: SYSTEM_USER_ID,
    repositoryId,
    issueNumber,
  });

  res.status(201).json(job);
});

// GET /jobs — list all jobs
jobsRouter.get('/', async (_req: Request, res: Response) => {
  const jobs = await db
    .select()
    .from(schema.agentJobs)
    .where(eq(schema.agentJobs.userId, SYSTEM_USER_ID))
    .orderBy(desc(schema.agentJobs.createdAt))
    .limit(50);
  res.json(jobs);
});

// GET /jobs/:id — get job details
jobsRouter.get('/:id', async (req: Request, res: Response) => {
  const [job] = await db
    .select()
    .from(schema.agentJobs)
    .where(
      and(eq(schema.agentJobs.id, req.params['id']!), eq(schema.agentJobs.userId, SYSTEM_USER_ID))
    )
    .limit(1);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

// GET /jobs/:id/events — SSE stream of job events
jobsRouter.get('/:id/events', async (req: Request, res: Response) => {
  const jobId = req.params['id']!;

  const [job] = await db
    .select()
    .from(schema.agentJobs)
    .where(and(eq(schema.agentJobs.id, jobId), eq(schema.agentJobs.userId, SYSTEM_USER_ID)))
    .limit(1);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const existingEvents = await db
    .select()
    .from(schema.agentEvents)
    .where(eq(schema.agentEvents.jobId, jobId))
    .orderBy(schema.agentEvents.createdAt);

  for (const event of existingEvents) {
    sendEvent(event);
  }

  let lastEventId = existingEvents[existingEvents.length - 1]?.id ?? '';
  let stopped = false;

  const poll = setInterval(async () => {
    if (stopped) return;
    try {
      const newEvents = await db
        .select()
        .from(schema.agentEvents)
        .where(eq(schema.agentEvents.jobId, jobId))
        .orderBy(schema.agentEvents.createdAt);

      const fresh = newEvents.filter((e) => e.id > lastEventId);
      for (const event of fresh) {
        sendEvent(event);
        lastEventId = event.id;
      }

      const [currentJob] = await db
        .select({ status: schema.agentJobs.status })
        .from(schema.agentJobs)
        .where(eq(schema.agentJobs.id, jobId))
        .limit(1);

      if (currentJob?.status === 'completed' || currentJob?.status === 'failed') {
        sendEvent({ type: 'done', status: currentJob.status });
        clearInterval(poll);
        res.end();
        stopped = true;
      }
    } catch {
      // Continue polling
    }
  }, 1000);

  req.on('close', () => {
    stopped = true;
    clearInterval(poll);
  });
});
