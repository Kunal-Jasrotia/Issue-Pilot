'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { api, type User } from '@/lib/api';
import { LayoutDashboard, FolderGit2, Bot, Settings, GitPullRequest } from 'lucide-react';

const navItems = [
  { href: '/dashboard',              label: 'Overview',      icon: LayoutDashboard },
  { href: '/dashboard/repositories', label: 'Repositories',  icon: FolderGit2 },
  { href: '/dashboard/jobs',         label: 'Agent Jobs',    icon: Bot },
  { href: '/dashboard/settings',     label: 'Settings',      icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.auth.me().then(setUser).catch(console.error);
  }, []);

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-800/80 bg-gray-900/80">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-gray-800/80 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm shadow-brand-600/30 ring-1 ring-brand-500/30 transition-transform group-hover:scale-105">
              <GitPullRequest className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">IssuePilot</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2.5 pt-3">
          <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
            Navigation
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600/15 text-brand-300'
                    : 'text-gray-400 hover:bg-gray-800/70 hover:text-gray-100'
                }`}
              >
                {/* Active left accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-500" />
                )}
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-400' : 'text-gray-500'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-800/80 p-3">
          {user ? (
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.login}
                  className="h-7 w-7 rounded-full ring-2 ring-gray-700 ring-offset-1 ring-offset-gray-900"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600/30 text-xs font-semibold text-brand-300">
                  {(user.name ?? user.login)[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-gray-200">
                  {user.name ?? user.login}
                </p>
                <p className="truncate text-xs text-gray-600">@{user.login}</p>
              </div>
            </div>
          ) : (
            <div className="h-10 rounded-lg shimmer" />
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
