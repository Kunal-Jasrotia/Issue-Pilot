import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { encrypt } from '../services/crypto.js';

export const authRouter = Router();

// GET /auth/me — returns info about the PAT owner, creates DB user row if missing
authRouter.get('/me', async (_req: Request, res: Response) => {
  try {
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
      return;
    }
    const octokit = new Octokit({ auth: token });
    const { data: ghUser } = await octokit.users.getAuthenticated();

    // Upsert the single system user row so it always exists in the DB
    const SYSTEM_USER_ID = '1';
    await db
      .insert(schema.users)
      .values({
        id: SYSTEM_USER_ID,
        githubId: ghUser.id,
        login: ghUser.login,
        name: ghUser.name ?? null,
        avatarUrl: ghUser.avatar_url,
        email: ghUser.email ?? null,
        accessToken: 'pat', // placeholder — actual token is read from env, not DB
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          login: ghUser.login,
          name: ghUser.name ?? null,
          avatarUrl: ghUser.avatar_url,
          email: ghUser.email ?? null,
          updatedAt: new Date(),
        },
      });

    // Also read LLM settings from the DB row if present
    const [dbUser] = await db
      .select({ llmProvider: schema.users.llmProvider, llmModel: schema.users.llmModel })
      .from(schema.users)
      .where(eq(schema.users.id, SYSTEM_USER_ID))
      .limit(1);

    res.json({
      id: SYSTEM_USER_ID,
      login: ghUser.login,
      name: ghUser.name ?? null,
      avatarUrl: ghUser.avatar_url,
      llmProvider: dbUser?.llmProvider ?? null,
      llmModel: dbUser?.llmModel ?? null,
    });
  } catch (err) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ error: 'Failed to fetch GitHub user' });
  }
});

// PUT /auth/settings — update LLM settings (single-user, no JWT needed)
const settingsSchema = z.object({
  llmProvider: z.enum(['openai', 'claude', 'ollama']).optional(),
  llmApiKey: z.string().optional(),
  llmModel: z.string().optional(),
  ollamaUrl: z.string().url().optional(),
});

authRouter.put('/settings', async (req: Request, res: Response) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const updates: Record<string, unknown> = {};
    if (parsed.data.llmProvider) updates['llmProvider'] = parsed.data.llmProvider;
    if (parsed.data.llmApiKey) updates['llmApiKey'] = encrypt(parsed.data.llmApiKey);
    if (parsed.data.llmModel) updates['llmModel'] = parsed.data.llmModel;
    if (parsed.data.ollamaUrl) updates['ollamaUrl'] = parsed.data.ollamaUrl;

    // Persist to the single system user row if it exists
    await db
      .update(schema.users)
      .set(updates as Partial<typeof schema.users.$inferInsert>)
      .where(eq(schema.users.id, '00000000-0000-0000-0000-000000000001'));

    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth] /settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});
