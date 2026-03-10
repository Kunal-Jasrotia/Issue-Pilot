export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  author: string;
  comments: IssueComment[];
}

export interface IssueComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
}

export interface GitHubRepository {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  cloneUrl: string;
  sshUrl: string;
  private: boolean;
  language: string | null;
  description: string | null;
}

export interface CreatePROptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface PullRequest {
  number: number;
  title: string;
  htmlUrl: string;
  state: string;
  head: string;
  base: string;
}
