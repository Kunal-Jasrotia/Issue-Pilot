import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IssuePilot — AI-powered GitHub issue resolver',
  description: 'Assign GitHub issues to an AI agent that automatically writes code and creates pull requests',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100">{children}</body>
    </html>
  );
}
