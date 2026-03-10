const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = (await res.json().catch(() => ({ error: res.statusText }))) as { error: string };
    throw new Error(error.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export interface User {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  llmProvider: string | null;
  llmModel: string | null;
}

export interface Repository {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  language: string | null;
  description: string | null;
  indexed: boolean;
  createdAt: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[];
  htmlUrl: string;
  author: string;
  createdAt: string;
}

export interface AgentJob {
  id: string;
  repositoryId: string;
  issueNumber: number;
  issueTitle: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  branchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
  error: string | null;
  steps: Array<{ name: string; success: boolean; output: string; duration: number }> | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export const api = {
  auth: {
    me: () => apiFetch<User>('/auth/me'),
    updateSettings: (data: {
      llmProvider?: string;
      llmApiKey?: string;
      llmModel?: string;
      ollamaUrl?: string;
    }) => apiFetch<{ ok: true }>('/auth/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  repositories: {
    list: () => apiFetch<Repository[]>('/api/repositories'),
    connect: (owner: string, name: string) =>
      apiFetch<Repository>('/api/repositories', {
        method: 'POST',
        body: JSON.stringify({ owner, name }),
      }),
    disconnect: (id: string) =>
      apiFetch<{ ok: true }>(`/api/repositories/${id}`, { method: 'DELETE' }),
    issues: (id: string) => apiFetch<Issue[]>(`/api/repositories/${id}/issues`),
  },

  jobs: {
    dispatch: (repositoryId: string, issueNumber: number, issueTitle: string) =>
      apiFetch<AgentJob>('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ repositoryId, issueNumber, issueTitle }),
      }),
    list: () => apiFetch<AgentJob[]>('/api/jobs'),
    get: (id: string) => apiFetch<AgentJob>(`/api/jobs/${id}`),
    eventsUrl: (id: string) => `${API_URL}/api/jobs/${id}/events`,
  },
};
