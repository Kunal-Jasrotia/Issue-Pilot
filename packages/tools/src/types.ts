export interface ToolContext {
  /** Absolute path to the repository root on disk */
  repoPath: string;
  /** Max bytes to read per file (default 500KB) */
  maxFileSize?: number;
  /** Allowed commands whitelist (regex patterns) */
  allowedCommands?: string[];
  /** Command execution timeout ms */
  commandTimeout?: number;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export type ToolHandler<TArgs = Record<string, unknown>, TResult = unknown> = (
  args: TArgs,
  ctx: ToolContext
) => Promise<ToolResult<TResult>>;
