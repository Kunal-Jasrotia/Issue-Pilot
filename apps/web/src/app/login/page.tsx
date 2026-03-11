'use client';
import { api, getToken } from '@/lib/api';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GitMerge, Code2, TestTube2, GitPullRequest, Search, ShieldCheck } from 'lucide-react';
import { GitHubIcon } from '@/components/ui/icons';

const features = [
  { icon: Search,        text: 'Reads and understands GitHub issues' },
  { icon: Code2,         text: 'Analyzes your repository structure' },
  { icon: GitMerge,      text: 'Writes code to resolve the issue' },
  { icon: TestTube2,     text: 'Runs your test suite to verify' },
  { icon: GitPullRequest, text: 'Opens a pull request automatically' },
];

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 overflow-hidden">
      {/* Background: subtle dot-grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Radial glow centred behind card */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className="h-[600px] w-[600px] rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, rgba(14,165,233,0.6) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative w-full max-w-sm space-y-7 animate-fade-in">
        {/* Logo + title */}
        <div className="text-center space-y-4">
          {/* Logo with ring glow */}
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-brand-600/30 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-600/30 ring-1 ring-brand-500/40">
              <GitPullRequest className="h-8 w-8 text-white" strokeWidth={2} />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">IssuePilot</h1>
            <p className="mt-1.5 text-sm text-gray-400">AI-powered GitHub issue resolver.</p>
          </div>
        </div>

        {/* Feature list card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 space-y-3 backdrop-blur-sm">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-gray-300">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600/15 ring-1 ring-brand-500/20">
                <Icon className="h-3.5 w-3.5 text-brand-400" strokeWidth={2} />
              </div>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Login CTA */}
        <div className="space-y-3">
          <button
            onClick={() => api.auth.githubLogin()}
            className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-md shadow-black/20 transition-all hover:bg-gray-50 active:scale-[0.98]"
          >
            {/* Hover shimmer */}
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700" />
            <GitHubIcon className="h-4.5 w-4.5" />
            Continue with GitHub
          </button>

          <p className="text-center text-xs text-gray-600">
            Requires{' '}
            <code className="rounded bg-gray-800 px-1 py-0.5 text-gray-400">repo</code>{' '}
            scope to read issues and create pull requests.
          </p>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600">
          <ShieldCheck className="h-3.5 w-3.5 text-gray-600" />
          <span>API keys encrypted at rest with AES-256-GCM</span>
        </div>
      </div>
    </main>
  );
}
