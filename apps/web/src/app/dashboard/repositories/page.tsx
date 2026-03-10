'use client';
import { useEffect, useState } from 'react';
import { api, type Repository, type Issue } from '@/lib/api';
import { FolderGit2, CircleDot, Bot, Loader2, ChevronRight, Tag } from 'lucide-react';

function DispatchedToast({ issueNumber }: { issueNumber: number }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 animate-fade-in rounded-xl border border-green-800 bg-green-950 px-4 py-3 shadow-xl">
      <p className="text-sm font-medium text-green-300">
        Agent job created for issue #{issueNumber}
      </p>
    </div>
  );
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectInput, setConnectInput] = useState('');
  const [connectError, setConnectError] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [dispatchingIssue, setDispatchingIssue] = useState<number | null>(null);
  const [dispatchedIssue, setDispatchedIssue] = useState<number | null>(null);

  useEffect(() => {
    api.repositories.list()
      .then(setRepos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    const [owner, name] = connectInput.trim().split('/');
    if (!owner || !name) {
      setConnectError('Enter in format: owner/repo');
      return;
    }
    setConnecting(true);
    setConnectError('');
    try {
      const repo = await api.repositories.connect(owner, name);
      setRepos((prev) => [repo, ...prev]);
      setConnectInput('');
    } catch (err) {
      setConnectError(String(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleSelectRepo = async (repo: Repository) => {
    setSelectedRepo(repo);
    setIssues([]);
    setIssuesLoading(true);
    try {
      const iss = await api.repositories.issues(repo.id);
      setIssues(iss);
    } catch (err) {
      console.error(err);
    } finally {
      setIssuesLoading(false);
    }
  };

  const handleDispatch = async (issue: Issue) => {
    if (!selectedRepo) return;
    setDispatchingIssue(issue.number);
    try {
      await api.jobs.dispatch(selectedRepo.id, issue.number, issue.title);
      setDispatchedIssue(issue.number);
      setTimeout(() => setDispatchedIssue(null), 3000);
    } catch (err) {
      alert(`Error: ${String(err)}`);
    } finally {
      setDispatchingIssue(null);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header + Connect */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950 px-8 py-5">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Repositories</h1>
            <p className="mt-0.5 text-sm text-gray-500">Connect GitHub repos and dispatch agent jobs</p>
          </div>
          {/* Inline connect form */}
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={connectInput}
                  onChange={(e) => { setConnectInput(e.target.value); setConnectError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && void handleConnect()}
                  placeholder="owner/repository"
                  className="w-56 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 transition-colors focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={() => void handleConnect()}
                  disabled={connecting || !connectInput.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {connecting ? 'Connecting…' : 'Connect'}
                </button>
              </div>
              {connectError && <p className="text-xs text-red-400">{connectError}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden divide-x divide-gray-800">
        {/* Repo list */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden">
          <div className="flex h-11 items-center justify-between border-b border-gray-800 px-4">
            <span className="text-xs font-medium text-gray-500">
              {loading ? 'Loading…' : `${repos.length} connected`}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
              </div>
            ) : repos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <FolderGit2 className="h-8 w-8 text-gray-700" strokeWidth={1.5} />
                <p className="text-sm text-gray-500">No repositories connected yet.</p>
                <p className="text-xs text-gray-600">Enter owner/repo above to connect.</p>
              </div>
            ) : (
              repos.map((repo) => {
                const isSelected = selectedRepo?.id === repo.id;
                return (
                  <button
                    key={repo.id}
                    onClick={() => void handleSelectRepo(repo)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-800/60 ${
                      isSelected ? 'bg-gray-800 border-l-2 border-brand-500' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <FolderGit2
                      className={`h-4 w-4 shrink-0 ${isSelected ? 'text-brand-400' : 'text-gray-500'}`}
                      strokeWidth={2}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {repo.fullName}
                      </p>
                      {repo.language && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{repo.language}</p>
                      )}
                    </div>
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-colors ${isSelected ? 'text-brand-400' : 'text-gray-600'}`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Issues panel */}
        <div className="flex flex-1 flex-col overflow-hidden bg-gray-950">
          <div className="flex h-11 shrink-0 items-center border-b border-gray-800 px-5">
            <span className="text-xs font-medium text-gray-500">
              {selectedRepo
                ? `Open issues — ${selectedRepo.name}`
                : 'Select a repository'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedRepo ? (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center h-full">
                <CircleDot className="h-9 w-9 text-gray-700" strokeWidth={1.5} />
                <p className="text-sm text-gray-500">Select a repository to view its open issues</p>
              </div>
            ) : issuesLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
              </div>
            ) : issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center h-full">
                <CircleDot className="h-9 w-9 text-gray-700" strokeWidth={1.5} />
                <p className="text-sm text-gray-500">No open issues in this repository</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-gray-900/40 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-green-500" strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200">
                          <span className="mr-1.5 font-mono text-xs text-gray-500">#{issue.number}</span>
                          {issue.title}
                        </p>
                        {issue.labels.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {issue.labels.map((label) => (
                              <span
                                key={label}
                                className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleDispatch(issue)}
                      disabled={dispatchingIssue === issue.number}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-brand-700/50 bg-brand-600/10 px-3 py-1.5 text-xs font-medium text-brand-400 transition-colors hover:bg-brand-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dispatchingIssue === issue.number ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                      {dispatchingIssue === issue.number ? 'Dispatching…' : 'Solve'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {dispatchedIssue && <DispatchedToast issueNumber={dispatchedIssue} />}
    </div>
  );
}
