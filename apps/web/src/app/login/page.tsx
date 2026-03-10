'use client';
import { api, getToken } from '@/lib/api';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GitMerge, Code2, TestTube2, GitPullRequest, Search, ShieldCheck } from 'lucide-react';
import { GitHubIcon } from '@/components/ui/icons';

const features = [
  { icon: Search, text: 'Reads and understands GitHub issues' },
  { icon: Code2, text: 'Analyzes your repository structure' },
  { icon: GitMerge, text: 'Writes code to resolve the issue' },
  { icon: TestTube2, text: 'Runs your test suite to verify' },
  { icon: GitPullRequest, text: 'Opens a pull request automatically' },
];

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      {/* Subtle background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative w-full max-w-sm space-y-6 animate-fade-in">
        {/* Logo mark + title */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/25">
            <GitPullRequest className="h-7 w-7 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">IssuePilot</h1>
            <p className="mt-1.5 text-sm text-gray-400">
              AI-powered GitHub issue resolver.
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-3 backdrop-blur-sm">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-gray-300">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-800">
                <Icon className="h-3.5 w-3.5 text-brand-400" strokeWidth={2} />
              </div>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Login button */}
        <div className="space-y-3">
          <button
            onClick={() => api.auth.githubLogin()}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all hover:bg-gray-100 active:scale-[0.98]"
          >
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
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>API keys encrypted at rest with AES-256-GCM</span>
        </div>
      </div>
    </main>
  );
}
