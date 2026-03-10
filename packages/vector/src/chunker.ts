import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
}

const SOURCE_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
};

const CHUNK_SIZE = 60; // lines per chunk
const CHUNK_OVERLAP = 10; // overlap lines

export async function chunkRepository(repoPath: string): Promise<CodeChunk[]> {
  const files = await glob('**/*', {
    cwd: repoPath,
    ignore: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
    ],
    nodir: true,
    absolute: true,
  });

  const chunks: CodeChunk[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const language = SOURCE_EXTENSIONS[ext];
    if (!language) continue;

    try {
      const stat = await fs.stat(file);
      if (stat.size > 200 * 1024) continue; // Skip files > 200KB

      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(repoPath, file);

      if (lines.length <= CHUNK_SIZE) {
        chunks.push({
          id: `${relativePath}:1-${lines.length}`,
          filePath: relativePath,
          content,
          startLine: 1,
          endLine: lines.length,
          language,
        });
      } else {
        for (let start = 0; start < lines.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
          const end = Math.min(start + CHUNK_SIZE, lines.length);
          const chunkContent = lines.slice(start, end).join('\n');

          chunks.push({
            id: `${relativePath}:${start + 1}-${end}`,
            filePath: relativePath,
            content: chunkContent,
            startLine: start + 1,
            endLine: end,
            language,
          });

          if (end >= lines.length) break;
        }
      }
    } catch {
      continue;
    }
  }

  return chunks;
}
