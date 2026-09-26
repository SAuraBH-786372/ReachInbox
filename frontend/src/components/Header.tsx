import React from 'react';
import { useUser } from '@/lib/UserContext';
import Image from 'next/image';

export function Header() {
  const { user, logout } = useUser();

  return (
    <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <span className="font-bold text-slate-950 text-lg">R</span>
          </div>
          <div>
            <span className="font-bold text-slate-100 tracking-tight text-lg">ReachInbox</span>
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Dashboard
            </span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <a href="/dashboard/settings" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                Settings
              </a>
            </div>
            <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
              {user.avatarUrl && (
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-700">
                   <Image src={user.avatarUrl} alt={user.name || 'User'} fill sizes="32px" />
                </div>
              )}
              <div className="flex flex-col hidden sm:flex mr-4">
                <span className="text-sm font-medium text-slate-200 leading-tight">{user.name}</span>
                <span className="text-xs text-slate-500 leading-tight">{user.email}</span>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

