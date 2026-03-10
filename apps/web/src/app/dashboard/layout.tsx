'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { api, type User } from '@/lib/api';
import { LayoutDashboard, FolderGit2, Bot, Settings, GitPullRequest } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/repositories', label: 'Repositories', icon: FolderGit2 },
  { href: '/dashboard/jobs', label: 'Agent Jobs', icon: Bot },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.auth.me().then(setUser).catch(console.error);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b border-gray-800 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
              <GitPullRequest className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">IssuePilot</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600/15 text-brand-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
              >
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
        {user && (
          <div className="border-t border-gray-800 p-3">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.login}
                  className="h-7 w-7 rounded-full ring-1 ring-gray-700"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-xs font-medium text-gray-300">
                  {(user.name ?? user.login)[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-gray-200">
                  {user.name ?? user.login}
                </p>
                <p className="truncate text-xs text-gray-500">@{user.login}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-950">{children}</main>
    </div>
  );
}
