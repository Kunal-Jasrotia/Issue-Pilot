import { Octokit } from '@octokit/rest';
import type {
  GitHubIssue,
  IssueComment,
  GitHubRepository,
  CreatePROptions,
  PullRequest,
} from './types.js';

export class GitHubClient {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  async getAuthenticatedUser(): Promise<{ login: string; name: string | null; avatarUrl: string }> {
    const { data } = await this.octokit.users.getAuthenticated();
    return {
      login: data.login,
      name: data.name ?? null,
      avatarUrl: data.avatar_url,
    };
  }

  async listUserRepositories(options?: {
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    perPage?: number;
    page?: number;
  }): Promise<GitHubRepository[]> {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      sort: options?.sort ?? 'updated',
      per_page: options?.perPage ?? 30,
      page: options?.page ?? 1,
    });

    return data.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      defaultBranch: r.default_branch,
      cloneUrl: r.clone_url,
      sshUrl: r.ssh_url,
      private: r.private,
      language: r.language ?? null,
      description: r.description ?? null,
    }));
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const { data } = await this.octokit.repos.get({ owner, repo });
    return {
      id: data.id,
      fullName: data.full_name,
      owner: data.owner.login,
      name: data.name,
      defaultBranch: data.default_branch,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      private: data.private,
      language: data.language ?? null,
      description: data.description ?? null,
    };
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const [{ data: issue }, { data: rawComments }] = await Promise.all([
      this.octokit.issues.get({ owner, repo, issue_number: issueNumber }),
      this.octokit.issues.listComments({ owner, repo, issue_number: issueNumber, per_page: 50 }),
    ]);

    const comments: IssueComment[] = rawComments.map((c) => ({
      id: c.id,
      body: c.body ?? '',
      author: c.user?.login ?? 'unknown',
      createdAt: c.created_at,
    }));

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state as 'open' | 'closed',
      labels: issue.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
      assignees: issue.assignees?.map((a) => a.login) ?? [],
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      htmlUrl: issue.html_url,
      author: issue.user?.login ?? 'unknown',
      comments,
    };
  }

  async listOpenIssues(
    owner: string,
    repo: string,
    options?: { label?: string; perPage?: number }
  ): Promise<GitHubIssue[]> {
    const { data } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state: 'open',
      labels: options?.label,
      per_page: options?.perPage ?? 30,
    });

    return data
      .filter((i) => !i.pull_request) // exclude PRs
      .map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: 'open' as const,
        labels: issue.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
        assignees: issue.assignees?.map((a) => a.login) ?? [],
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        htmlUrl: issue.html_url,
        author: issue.user?.login ?? 'unknown',
        comments: [],
      }));
  }

  async addIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    await this.octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  }

  async addIssueLabel(
    owner: string,
    repo: string,
    issueNumber: number,
    label: string
  ): Promise<void> {
    await this.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: [label],
    });
  }

  async createPullRequest(options: CreatePROptions): Promise<PullRequest> {
    const { data } = await this.octokit.pulls.create({
      owner: options.owner,
      repo: options.repo,
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
      draft: options.draft ?? false,
    });

    return {
      number: data.number,
      title: data.title,
      htmlUrl: data.html_url,
      state: data.state,
      head: data.head.ref,
      base: data.base.ref,
    };
  }

  async ensureLabelExists(
    owner: string,
    repo: string,
    labelName: string,
    color = 'A2EEEF'
  ): Promise<void> {
    try {
      await this.octokit.issues.getLabel({ owner, repo, name: labelName });
    } catch {
      await this.octokit.issues.createLabel({
        owner,
        repo,
        name: labelName,
        color,
        description: 'Assign this issue to the IssuePilot AI agent',
      });
    }
  }

  async setupWebhook(
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string
  ): Promise<number> {
    try {
      const { data } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret,
        },
        events: ['issues', 'issue_comment'],
        active: true,
      });
      return data.id;
    } catch (err: unknown) {
      // 422 = hook already exists — find and return its ID
      const status = (err as { status?: number }).status;
      if (status === 422) {
        const { data: hooks } = await this.octokit.repos.listWebhooks({
          owner,
          repo,
          per_page: 100,
        });
        const existing = hooks.find((h) => h.config.url === webhookUrl);
        if (existing) return existing.id;
      }
      throw err;
    }
  }
}
