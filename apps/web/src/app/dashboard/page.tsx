'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type AgentJob, type Repository } from '@/lib/api';
import { FolderGit2, Bot, CheckCircle2, Zap, ArrowRight, ExternalLink, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  queued:    { label: 'Queued',    classes: 'text-amber-400  bg-amber-400/10  ring-amber-400/20',  dot: 'bg-amber-400' },
  running:   { label: 'Running',   classes: 'text-blue-400   bg-blue-400/10   ring-blue-400/20',   dot: 'bg-blue-400 animate-pulse' },
  completed: { label: 'Completed', classes: 'text-green-400  bg-green-400/10  ring-green-400/20',  dot: 'bg-green-400' },
  failed:    { label: 'Failed',    classes: 'text-red-400    bg-red-400/10    ring-red-400/20',    dot: 'bg-red-400' },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.jobs.list(), api.repositories.list()])
      .then(([j, r]) => { setJobs(j); setRepos(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      label: 'Repositories',
      value: repos.length,
      icon: FolderGit2,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-400/10',
      accent: 'from-blue-500/50',
      href: '/dashboard/repositories',
    },
    {
      label: 'Total Jobs',
      value: jobs.length,
      icon: Bot,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-400/10',
      accent: 'from-violet-500/50',
      href: '/dashboard/jobs',
    },
    {
      label: 'Completed',
      value: jobs.filter((j) => j.status === 'completed').length,
      icon: CheckCircle2,
      iconColor: 'text-green-400',
      iconBg: 'bg-green-400/10',
      accent: 'from-green-500/50',
      href: '/dashboard/jobs',
    },
    {
      label: 'Running Now',
      value: jobs.filter((j) => j.status === 'running').length,
      icon: Zap,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-400/10',
      accent: 'from-amber-500/50',
      href: '/dashboard/jobs',
    },
  ];

  const recentJobs = jobs.slice(0, 8);

  return (
    <div className="p-8 space-y-8 max-w-5xl animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Overview</h1>
        <p className="mt-0.5 text-sm text-gray-500">Monitor your AI agent activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900 p-5 transition-all hover:border-gray-700 hover:shadow-lg hover:shadow-black/20"
            >
              {/* Top gradient accent */}
              <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${stat.accent} to-transparent`} />

              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg}`}>
                <Icon className={`h-[18px] w-[18px] ${stat.iconColor}`} strokeWidth={2} />
              </div>
              <div className="text-2xl font-bold tabular-nums text-white">
                {loading ? <span className="inline-block h-6 w-8 rounded shimmer" /> : stat.value}
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-xs text-gray-500">{stat.label}</span>
                <ArrowRight className="h-3 w-3 text-gray-700 transition-all group-hover:text-gray-400 group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent jobs */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">Recent Jobs</h2>
          <Link
            href="/dashboard/jobs"
            className="flex items-center gap-1 text-xs text-brand-400 transition-colors hover:text-brand-300"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          {loading ? (
            <div className="space-y-px p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-11 rounded-lg shimmer" />
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-800">
                <Bot className="h-7 w-7 text-gray-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">No agent jobs yet</p>
                <p className="mt-0.5 text-xs text-gray-600">Dispatch an issue to get started</p>
              </div>
              <Link
                href="/dashboard/repositories"
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-600/15 px-3 py-1.5 text-xs font-medium text-brand-400 ring-1 ring-brand-500/20 transition-colors hover:bg-brand-600/25"
              >
                Connect a repository
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:table-cell">
                    Created
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="group hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="shrink-0 rounded-md bg-gray-800 px-1.5 py-0.5 font-mono text-xs text-gray-400">
                          #{job.issueNumber}
                        </span>
                        <span className="truncate text-sm text-gray-200 max-w-xs">{job.issueTitle}</span>
                        {job.prUrl && (
                          <a
                            href={job.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            title="View pull request"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-brand-400" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusBadge status={job.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
