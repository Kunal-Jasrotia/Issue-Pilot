'use client';
import { useEffect, useState, useRef } from 'react';
import { api, type AgentJob } from '@/lib/api';
import {
  Bot,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Loader2,
} from 'lucide-react';

const STATUS_CONFIG = {
  queued: {
    label: 'Queued',
    classes: 'text-amber-400 bg-amber-400/10 ring-amber-400/20',
    dot: 'bg-amber-400',
    dotPulse: false,
  },
  running: {
    label: 'Running',
    classes: 'text-blue-400 bg-blue-400/10 ring-blue-400/20',
    dot: 'bg-blue-400',
    dotPulse: true,
  },
  completed: {
    label: 'Completed',
    classes: 'text-green-400 bg-green-400/10 ring-green-400/20',
    dot: 'bg-green-400',
    dotPulse: false,
  },
  failed: {
    label: 'Failed',
    classes: 'text-red-400 bg-red-400/10 ring-red-400/20',
    dot: 'bg-red-400',
    dotPulse: false,
  },
};

const EVENT_TYPE_COLOR: Record<string, string> = {
  plan:   'text-violet-400',
  code:   'text-blue-400',
  test:   'text-cyan-400',
  review: 'text-amber-400',
  commit: 'text-green-400',
  pr:     'text-emerald-400',
  error:  'text-red-400',
  info:   'text-gray-400',
};

interface AgentEventMsg {
  type: string;
  message: string;
  data?: unknown;
  createdAt?: string;
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cfg.dotPulse ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

function JobDetail({ job }: { job: AgentJob }) {
  const [events, setEvents] = useState<AgentEventMsg[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEvents([]);
    const es = new EventSource(api.jobs.eventsUrl(job.id));

    es.onmessage = (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as AgentEventMsg;
      if (data.type === 'done') { es.close(); return; }
      setEvents((prev) => [...prev, data]);
      setTimeout(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    };

    return () => es.close();
  }, [job.id]);

  return (
    <div className="flex h-full flex-col gap-4 animate-fade-in">
      {/* Detail header */}
      <div className="shrink-0 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">
              <span className="mr-2 font-mono text-sm text-gray-500">#{job.issueNumber}</span>
              {job.issueTitle}
            </h2>
            {job.branchName && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                <GitBranch className="h-3.5 w-3.5" />
                <code className="font-mono">{job.branchName}</code>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge status={job.status} />
            {job.prUrl && (
              <a
                href={job.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-brand-700/50 bg-brand-600/10 px-3 py-1.5 text-xs font-medium text-brand-400 transition-colors hover:bg-brand-600/20"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View PR
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline steps */}
      {job.steps && job.steps.length > 0 && (
        <div className="shrink-0 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Pipeline Steps
          </p>
          <div className="space-y-2.5">
            {job.steps.map((step, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-sm">
                  {step.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" strokeWidth={2} />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" strokeWidth={2} />
                  )}
                  <span className={step.success ? 'text-gray-300' : 'text-red-400'}>
                    {step.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                  <Clock className="h-2.5 w-2.5" />
                  {step.duration}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live log */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-gray-800 bg-gray-950 flex flex-col">
        {/* Log toolbar */}
        <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900/60 px-3 py-2">
          {/* macOS-style window dots */}
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <div className="flex items-center gap-1.5 ml-2">
            <Terminal className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Agent Log</span>
          </div>
          {job.status === 'running' && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-blue-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 glow-pulse" />
              Live
            </span>
          )}
          {events.length > 0 && job.status !== 'running' && (
            <span className="ml-auto text-xs text-gray-600">{events.length} events</span>
          )}
        </div>

        {/* Log body */}
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-6 space-y-0.5 scanlines"
        >
          {events.length === 0 ? (
            <p className="text-gray-600 italic">Waiting for events…</p>
          ) : (
            events.map((event, i) => (
              <div key={i} className="flex gap-2.5 group">
                {event.createdAt && (
                  <span className="shrink-0 text-gray-700 select-none tabular-nums">
                    {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                <span className={`shrink-0 font-semibold ${EVENT_TYPE_COLOR[event.type] ?? 'text-gray-500'}`}>
                  [{event.type}]
                </span>
                <span className="text-gray-300 break-all">{event.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Error box */}
      {job.error && (
        <div className="shrink-0 rounded-xl border border-red-900/60 bg-red-950/20 p-4">
          <div className="mb-2 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" strokeWidth={2} />
            <p className="text-xs font-semibold text-red-400">Error</p>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs text-red-300/80">{job.error}</pre>
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<AgentJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.jobs
      .list()
      .then((j) => {
        setJobs(j);
        if (j[0]) setSelectedJob(j[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      api.jobs.list().then(setJobs).catch(() => null);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Job list sidebar */}
      <div className="flex w-72 shrink-0 flex-col border-r border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="flex h-14 items-center justify-between border-b border-gray-800 px-4">
          <span className="text-sm font-semibold text-gray-200">Agent Jobs</span>
          {!loading && (
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-gray-700">
              {jobs.length}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-px p-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg shimmer" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Bot className="h-9 w-9 text-gray-700" strokeWidth={1.5} />
              <p className="text-sm text-gray-500">No jobs yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {jobs.map((job) => {
                const cfg = STATUS_CONFIG[job.status];
                const isSelected = selectedJob?.id === job.id;
                return (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-gray-800/80'
                        : 'hover:bg-gray-800/40'
                    }`}
                  >
                    {/* Left accent bar */}
                    <span
                      className={`absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full transition-all ${
                        isSelected ? 'bg-brand-500 opacity-100' : 'opacity-0'
                      }`}
                    />
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot} ${cfg.dotPulse ? 'animate-pulse' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        #{job.issueNumber}: {job.issueTitle}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-auto bg-gray-950 p-6">
        {selectedJob ? (
          <JobDetail key={selectedJob.id} job={selectedJob} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 border border-gray-800">
              <Bot className="h-8 w-8 text-gray-700" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-gray-500">Select a job to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
