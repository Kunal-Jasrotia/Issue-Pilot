import path from 'node:path';
import fs from 'node:fs/promises';
import simpleGit from 'simple-git';

export interface CloneOptions {
  /** GitHub access token for authentication */
  accessToken: string;
  /** Full repo name e.g. "owner/repo" */
  fullName: string;
  /** HTTPS clone URL */
  cloneUrl: string;
  /** Base directory where repos are stored */
  reposDir: string;
  /** Branch to checkout (default: default branch) */
  branch?: string;
}

export interface CloneResult {
  repoPath: string;
  isExisting: boolean;
}

/**
 * Clone or update a repository locally.
 * Uses token-authenticated HTTPS to avoid SSH key requirements.
 */
export async function cloneOrUpdateRepo(options: CloneOptions): Promise<CloneResult> {
  const { accessToken, fullName, cloneUrl, reposDir, branch } = options;

  // Embed token in URL for auth: https://token@github.com/owner/repo.git
  const url = new URL(cloneUrl);
  url.username = 'x-access-token';
  url.password = accessToken;
  const authedUrl = url.toString();

  const repoPath = path.join(reposDir, fullName.replace('/', '_'));
  await fs.mkdir(reposDir, { recursive: true });

  const exists = await fs
    .access(path.join(repoPath, '.git'))
    .then(() => true)
    .catch(() => false);

  const g = simpleGit();

  if (exists) {
    const repo = simpleGit(repoPath);
    await repo.remote(['set-url', 'origin', authedUrl]);
    await repo.fetch('origin');
    if (branch) {
      await repo.checkout(branch);
    }
    await repo.pull('origin', branch ?? 'HEAD');
    return { repoPath, isExisting: true };
  } else {
    const cloneArgs = branch ? ['--branch', branch, '--depth', '10'] : ['--depth', '10'];
    await g.clone(authedUrl, repoPath, cloneArgs);
    // Remove auth from remote URL after clone for safety
    const repo = simpleGit(repoPath);
    const cleanUrl = cloneUrl;
    await repo.remote(['set-url', 'origin', cleanUrl]);
    return { repoPath, isExisting: false };
  }
}

/**
 * Set the authenticated remote URL before pushing.
 * Call this right before git push, then restore clean URL after.
 */
export async function withAuthenticatedRemote<T>(
  repoPath: string,
  accessToken: string,
  cloneUrl: string,
  fn: () => Promise<T>
): Promise<T> {
  const repo = simpleGit(repoPath);
  const url = new URL(cloneUrl);
  url.username = 'x-access-token';
  url.password = accessToken;
  const authedUrl = url.toString();

  await repo.remote(['set-url', 'origin', authedUrl]);
  try {
    return await fn();
  } finally {
    await repo.remote(['set-url', 'origin', cloneUrl]);
  }
}
