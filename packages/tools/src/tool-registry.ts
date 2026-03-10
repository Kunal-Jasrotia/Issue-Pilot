import type { ToolDefinition } from '@issuepilot/llm';
import type { ToolContext, ToolResult } from './types.js';
import { readFile, writeFile, editFile, listDirectory, searchCode, getRepoStructure } from './file-tools.js';
import { runCommand } from './command-tools.js';
import { gitStatus, gitDiff, createBranch, gitAdd, gitCommit, gitLog, gitPush } from './git-tools.js';

type AnyArgs = Record<string, unknown>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: (args: AnyArgs, ctx: ToolContext) => Promise<ToolResult>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the repository',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from repo root' },
        startLine: { type: 'number', description: 'Start line (1-indexed, optional)' },
        endLine: { type: 'number', description: 'End line (inclusive, optional)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a file with new content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from repo root' },
        content: { type: 'string', description: 'Full file content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Edit a file by replacing an exact string with new content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from repo root' },
        oldContent: { type: 'string', description: 'Exact string to find and replace' },
        newContent: { type: 'string', description: 'Replacement string' },
      },
      required: ['path', 'oldContent', 'newContent'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at a path',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path (default: repo root)' },
      },
      required: [],
    },
  },
  {
    name: 'search_code',
    description: 'Search for a string pattern across all source files',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or pattern to search for' },
        filePattern: { type: 'string', description: 'Glob pattern for files (optional)' },
        maxResults: { type: 'number', description: 'Max results to return (default 50)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_repo_structure',
    description: 'Get a tree view of the repository file structure',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the repository (tests, builds, linting)',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        cwd: { type: 'string', description: 'Working directory relative to repo root' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Get git status of the repository',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'git_diff',
    description: 'Get git diff of current changes',
    parameters: {
      type: 'object',
      properties: {
        staged: { type: 'boolean', description: 'Show staged changes only' },
      },
      required: [],
    },
  },
  {
    name: 'create_branch',
    description: 'Create and checkout a new git branch',
    parameters: {
      type: 'object',
      properties: {
        branchName: { type: 'string', description: 'Name of the branch to create' },
      },
      required: ['branchName'],
    },
  },
  {
    name: 'git_add',
    description: 'Stage files for commit',
    parameters: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to stage (omit to stage all)',
        },
      },
      required: [],
    },
  },
  {
    name: 'git_commit',
    description: 'Create a git commit with staged changes',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_log',
    description: 'Get recent git commit history',
    parameters: {
      type: 'object',
      properties: {
        maxCount: { type: 'number', description: 'Max number of commits (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'git_push',
    description: 'Push the current branch to remote',
    parameters: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: 'Branch name to push' },
        remote: { type: 'string', description: 'Remote name (default: origin)' },
        force: { type: 'boolean', description: 'Force push' },
      },
      required: ['branch'],
    },
  },
];

const handlers: Record<string, (args: AnyArgs, ctx: ToolContext) => Promise<ToolResult>> = {
  read_file: (a, c) => readFile(a as Parameters<typeof readFile>[0], c),
  write_file: (a, c) => writeFile(a as Parameters<typeof writeFile>[0], c),
  edit_file: (a, c) => editFile(a as Parameters<typeof editFile>[0], c),
  list_directory: (a, c) => listDirectory(a as Parameters<typeof listDirectory>[0], c),
  search_code: (a, c) => searchCode(a as Parameters<typeof searchCode>[0], c),
  get_repo_structure: (a, c) => getRepoStructure(a as never, c),
  run_command: (a, c) => runCommand(a as Parameters<typeof runCommand>[0], c),
  git_status: (a, c) => gitStatus(a as never, c),
  git_diff: (a, c) => gitDiff(a as Parameters<typeof gitDiff>[0], c),
  create_branch: (a, c) => createBranch(a as Parameters<typeof createBranch>[0], c),
  git_add: (a, c) => gitAdd(a as Parameters<typeof gitAdd>[0], c),
  git_commit: (a, c) => gitCommit(a as Parameters<typeof gitCommit>[0], c),
  git_log: (a, c) => gitLog(a as Parameters<typeof gitLog>[0], c),
  git_push: (a, c) => gitPush(a as Parameters<typeof gitPush>[0], c),
};

export async function executeTool(
  name: string,
  args: AnyArgs,
  ctx: ToolContext
): Promise<ToolResult> {
  const handler = handlers[name];
  if (!handler) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  return handler(args, ctx);
}

export { TOOL_DEFINITIONS as toolDefinitions };
