import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import ignore from 'ignore';
import type { ToolContext, ToolResult } from './types.js';

const DEFAULT_MAX_FILE_SIZE = 500 * 1024; // 500KB

function resolveSafe(repoPath: string, filePath: string): string {
  const resolved = path.resolve(repoPath, filePath);
  if (!resolved.startsWith(path.resolve(repoPath))) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
  return resolved;
}

export async function readFile(
  args: { path: string; startLine?: number; endLine?: number },
  ctx: ToolContext
): Promise<ToolResult<string>> {
  try {
    const fullPath = resolveSafe(ctx.repoPath, args.path);
    const stat = await fs.stat(fullPath);
    const maxSize = ctx.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;

    if (stat.size > maxSize) {
      return {
        success: false,
        error: `File too large: ${stat.size} bytes (max ${maxSize})`,
      };
    }

    const content = await fs.readFile(fullPath, 'utf-8');

    if (args.startLine !== undefined || args.endLine !== undefined) {
      const lines = content.split('\n');
      const start = (args.startLine ?? 1) - 1;
      const end = args.endLine ?? lines.length;
      return { success: true, data: lines.slice(start, end).join('\n') };
    }

    return { success: true, data: content };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function writeFile(
  args: { path: string; content: string },
  ctx: ToolContext
): Promise<ToolResult<void>> {
  try {
    const fullPath = resolveSafe(ctx.repoPath, args.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, args.content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function editFile(
  args: { path: string; oldContent: string; newContent: string },
  ctx: ToolContext
): Promise<ToolResult<void>> {
  try {
    const fullPath = resolveSafe(ctx.repoPath, args.path);
    const existing = await fs.readFile(fullPath, 'utf-8');

    if (!existing.includes(args.oldContent)) {
      return {
        success: false,
        error: 'oldContent not found in file. The file may have changed.',
      };
    }

    const updated = existing.replace(args.oldContent, args.newContent);
    await fs.writeFile(fullPath, updated, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function listDirectory(
  args: { path?: string },
  ctx: ToolContext
): Promise<ToolResult<string[]>> {
  try {
    const dirPath = resolveSafe(ctx.repoPath, args.path ?? '.');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function searchCode(
  args: { query: string; filePattern?: string; maxResults?: number },
  ctx: ToolContext
): Promise<ToolResult<Array<{ file: string; line: number; content: string }>>> {
  try {
    const pattern = args.filePattern ?? '**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,c,cpp,h}';
    const files = await glob(pattern, {
      cwd: ctx.repoPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**'],
      absolute: true,
    });

    // Load .gitignore
    let ig = ignore();
    try {
      const gitignoreContent = await fs.readFile(path.join(ctx.repoPath, '.gitignore'), 'utf-8');
      ig = ignore().add(gitignoreContent);
    } catch {
      // No .gitignore
    }

    const results: Array<{ file: string; line: number; content: string }> = [];
    const maxResults = args.maxResults ?? 50;
    const queryLower = args.query.toLowerCase();

    for (const file of files) {
      const relative = path.relative(ctx.repoPath, file);
      if (ig.ignores(relative)) continue;

      try {
        const stat = await fs.stat(file);
        if (stat.size > DEFAULT_MAX_FILE_SIZE) continue;

        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line !== undefined && line.toLowerCase().includes(queryLower)) {
            results.push({ file: relative, line: i + 1, content: line.trim() });
            if (results.length >= maxResults) break;
          }
        }
      } catch {
        continue;
      }

      if (results.length >= maxResults) break;
    }

    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function getRepoStructure(
  _args: Record<string, never>,
  ctx: ToolContext
): Promise<ToolResult<string>> {
  try {
    const files = await glob('**/*', {
      cwd: ctx.repoPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**', '**/coverage/**'],
      nodir: false,
    });

    const tree = files.sort().slice(0, 500).join('\n');
    return { success: true, data: tree };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
