import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { UserProvider } from '@/lib/UserContext';

export const metadata: Metadata = {
  title: 'ReachInbox | Distributed Email Job Scheduler',
  description: 'Production-grade email scheduler with BullMQ, Redis, PostgreSQL, and Elasticsearch',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen antialiased">
        <ToastProvider>
          <UserProvider>
            {children}
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
