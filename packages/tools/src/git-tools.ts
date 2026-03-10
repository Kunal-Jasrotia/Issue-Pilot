import simpleGit, { type SimpleGit } from 'simple-git';
import type { ToolContext, ToolResult } from './types.js';

function git(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export async function gitStatus(
  _args: Record<string, never>,
  ctx: ToolContext
): Promise<ToolResult<string>> {
  try {
    const status = await git(ctx.repoPath).status();
    const lines: string[] = [];
    if (status.modified.length) lines.push(`Modified: ${status.modified.join(', ')}`);
    if (status.created.length) lines.push(`Created: ${status.created.join(', ')}`);
    if (status.deleted.length) lines.push(`Deleted: ${status.deleted.join(', ')}`);
    if (status.not_added.length) lines.push(`Untracked: ${status.not_added.join(', ')}`);
    return { success: true, data: lines.join('\n') || 'Clean working tree' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function gitDiff(
  args: { staged?: boolean },
  ctx: ToolContext
): Promise<ToolResult<string>> {
  try {
    const g = git(ctx.repoPath);
    const diff = args.staged ? await g.diff(['--staged']) : await g.diff();
    return { success: true, data: diff || 'No changes' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function createBranch(
  args: { branchName: string },
  ctx: ToolContext
): Promise<ToolResult<void>> {
  try {
    await git(ctx.repoPath).checkoutLocalBranch(args.branchName);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function gitAdd(
  args: { paths?: string[] },
  ctx: ToolContext
): Promise<ToolResult<void>> {
  try {
    const g = git(ctx.repoPath);
    if (args.paths && args.paths.length > 0) {
      await g.add(args.paths);
    } else {
      await g.add('.');
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function gitCommit(
  args: { message: string },
  ctx: ToolContext
): Promise<ToolResult<string>> {
  try {
    const result = await git(ctx.repoPath).commit(args.message);
    return { success: true, data: result.commit };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function gitLog(
  args: { maxCount?: number },
  ctx: ToolContext
): Promise<ToolResult<string>> {
  try {
    const log = await git(ctx.repoPath).log({ maxCount: args.maxCount ?? 10 });
    const lines = log.all.map(
      (c) => `${c.hash.slice(0, 8)} ${c.date.slice(0, 10)} ${c.message}`
    );
    return { success: true, data: lines.join('\n') };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function gitPush(
  args: { remote?: string; branch: string; force?: boolean },
  ctx: ToolContext
): Promise<ToolResult<void>> {
  try {
    const g = git(ctx.repoPath);
    const remote = args.remote ?? 'origin';
    await g.push(remote, args.branch, args.force ? ['--force'] : ['--set-upstream']);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
