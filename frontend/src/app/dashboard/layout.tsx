'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { CalendarIcon, CheckIcon, Archive, Settings, Menu } from 'lucide-react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import ComposeModal from '@/components/ComposeModal';
import { useUser } from '@/lib/UserContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const pathname = usePathname();

  const { data: scheduledData } = useSWR(user ? '/api/emails/scheduled' : null, fetcher, { refreshInterval: 30000 });
  const { data: sentData } = useSWR(user ? '/api/emails/sent' : null, fetcher, { refreshInterval: 30000 });
  const { data: archivedData } = useSWR(user ? '/api/emails/archived' : null, fetcher, { refreshInterval: 30000 });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  if (!user) return null; // router.replace already fired

  const scheduledCount = scheduledData?.total || 0;
  const sentCount = sentData?.total || 0;
  const archivedCount = archivedData?.total || 0;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white text-gray-900 border-r border-gray-200 w-60">
      <div className="p-4 border-b border-gray-100 flex items-center h-16">
        <span className="font-bold text-xl tracking-wide">ONG</span>
      </div>

      <div className="p-4 border-b border-gray-100 group relative cursor-pointer hover:bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
            {user?.avatarUrl ? (
              <Image src={user.avatarUrl} alt={user.name || 'User'} fill sizes="32px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-200">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-gray-900 truncate">{user?.name || user?.email}</span>
            <span className="text-xs text-gray-500 truncate">{user?.email}</span>
          </div>
        </div>
        {/* Simple hover dropdown for logout */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={logout} className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Logout</button>
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => setComposeOpen(true)}
          className="w-full bg-green-500 hover:bg-green-600 text-white rounded-full py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors border border-green-600 shadow-sm"
        >
          Compose
        </button>
      </div>

      <div className="px-2 py-2 flex-1 flex flex-col gap-1 overflow-y-auto">
        <span className="text-xs font-semibold text-gray-400 px-3 mt-2 mb-1">CORE</span>
        <Link href="/dashboard/scheduled" className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${pathname.includes('/scheduled') ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            <span>Scheduled</span>
          </div>
          <span className="bg-green-100 text-green-700 text-xs rounded-full px-2 py-0.5">{scheduledCount}</span>
        </Link>

        <Link href="/dashboard/sent" className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${pathname.includes('/sent') ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            <span>Sent</span>
          </div>
          <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">{sentCount}</span>
        </Link>
        
        <Link href="/dashboard/archived" className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${pathname.includes('/archived') ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4" />
            <span>Archived</span>
          </div>
          <span className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">{archivedCount}</span>
        </Link>
        
        <Link href="/dashboard/settings" className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors mt-auto mb-2 ${pathname.includes('/settings') ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-gray-900/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 h-full w-60 transform transition-transform duration-300 ease-in-out">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-60 min-h-screen relative w-full overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <span className="font-bold text-xl">ONG</span>
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      
      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
    </div>
  );
}
