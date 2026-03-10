import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { GitHubClient } from '@issuepilot/github';
import { SYSTEM_USER_ID } from '../middleware/auth.js';

export const repoRouter = Router();

// Helper: get GitHub token from env
function getGitHubToken(): string {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) throw new Error('GITHUB_TOKEN env var is not set');
  return token;
}

// GET /repositories — list connected repositories
repoRouter.get('/', async (_req: Request, res: Response) => {
  const repos = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.userId, SYSTEM_USER_ID));
  res.json(repos);
});

// POST /repositories — connect a repository
const connectSchema = z.object({
  owner: z.string(),
  name: z.string(),
});

repoRouter.post('/', async (req: Request, res: Response) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const gh = new GitHubClient(getGitHubToken());
    const repoData = await gh.getRepository(parsed.data.owner, parsed.data.name);

    const webhookUrl = `${process.env['WEBHOOK_PROXY_URL'] ?? process.env['API_URL'] ?? 'http://localhost:3001'}/webhooks/github`;
    const webhookSecret = process.env['WEBHOOK_SECRET'] ?? 'change-me';

    let webhookId: number | undefined;
    try {
      webhookId = await gh.setupWebhook(
        parsed.data.owner,
        parsed.data.name,
        webhookUrl,
        webhookSecret
      );
      await gh.ensureLabelExists(parsed.data.owner, parsed.data.name, 'ai-agent');
    } catch (err) {
      console.warn('[Repo] Webhook setup failed (may already exist):', String(err));
    }

    const [repo] = await db
      .insert(schema.repositories)
      .values({
        userId: SYSTEM_USER_ID,
        githubId: repoData.id,
        fullName: repoData.fullName,
        owner: repoData.owner,
        name: repoData.name,
        defaultBranch: repoData.defaultBranch,
        cloneUrl: repoData.cloneUrl,
        private: repoData.private,
        language: repoData.language,
        description: repoData.description,
        webhookId,
      })
      .onConflictDoUpdate({
        target: [schema.repositories.userId, schema.repositories.githubId],
        set: { webhookId },
      })
      .returning();

    res.status(201).json(repo);
  } catch (err) {
    console.error('[Repo] Connect error:', err);
    res.status(400).json({ error: String(err) });
  }
});

// DELETE /repositories/:id — disconnect a repository
repoRouter.delete('/:id', async (req: Request, res: Response) => {
  const [repo] = await db
    .select()
    .from(schema.repositories)
    .where(
      and(
        eq(schema.repositories.id, req.params['id']!),
        eq(schema.repositories.userId, SYSTEM_USER_ID)
      )
    )
    .limit(1);

  if (!repo) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }

  await db.delete(schema.repositories).where(eq(schema.repositories.id, repo.id));
  res.json({ ok: true });
});

// GET /repositories/:id/issues — list open issues
repoRouter.get('/:id/issues', async (req: Request, res: Response) => {
  const [repo] = await db
    .select()
    .from(schema.repositories)
    .where(
      and(
        eq(schema.repositories.id, req.params['id']!),
        eq(schema.repositories.userId, SYSTEM_USER_ID)
      )
    )
    .limit(1);

  if (!repo) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }

  try {
    const gh = new GitHubClient(getGitHubToken());
    const issues = await gh.listOpenIssues(repo.owner, repo.name);
    res.json(issues);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});
