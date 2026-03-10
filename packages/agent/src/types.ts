import type { LLMProvider } from '@issuepilot/llm';
import type { GitHubIssue, GitHubRepository, PullRequest } from '@issuepilot/github';

export interface AgentConfig {
  provider: LLMProvider;
  repoPath: string;
  repository: GitHubRepository;
  issue: GitHubIssue;
  githubToken: string;
  maxIterations?: number;
  maxTokensPerStep?: number;
  onProgress?: (event: AgentEvent) => void | Promise<void>;
}

export type AgentEventType =
  | 'started'
  | 'planning'
  | 'coding'
  | 'testing'
  | 'reviewing'
  | 'fixing'
  | 'committing'
  | 'creating_pr'
  | 'completed'
  | 'failed'
  | 'log';

export interface AgentEvent {
  type: AgentEventType;
  message: string;
  data?: unknown;
  timestamp: Date;
}

export interface AgentResult {
  success: boolean;
  pullRequest?: PullRequest;
  branchName?: string;
  error?: string;
  steps: AgentStep[];
}

export interface AgentStep {
  name: string;
  success: boolean;
  output: string;
  duration: number;
}

export interface Plan {
  summary: string;
  steps: PlanStep[];
  filesToModify: string[];
  filesToCreate: string[];
  testStrategy: string;
}

export interface PlanStep {
  id: number;
  description: string;
  type: 'analyze' | 'modify' | 'create' | 'test' | 'verify';
  file?: string;
}
