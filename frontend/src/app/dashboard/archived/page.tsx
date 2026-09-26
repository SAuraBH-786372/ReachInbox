'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { fetchApi } from '@/lib/api';
import { EmailJob } from '@reachinbox/types';
import { StatusBadge } from '@/components/StatusBadge';
import { EmailDetailPanel } from '@/components/EmailDetailPanel';
import { useToast } from '@/components/ToastProvider';
import { Search, RefreshCw, Archive, Star, Clock } from 'lucide-react';

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function formatUpdatedTime(dateStr: string | Date): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function ArchivedPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, mutate } = useSWR(
    `/api/emails/archived?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const emails = data?.data || [];
  const total = data?.total || 0;

  async function handleDelete(id: string) {
    try {
      const res = await fetchApi(`/api/emails/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedEmail(null);
        mutate();
        toast.success('Email deleted');
      } else {
        toast.error('Failed to delete email');
      }
    } catch {
      toast.error('Failed to delete email');
    }
  }

  async function handleUnarchive(id: string) {
    try {
      const res = await fetchApi(`/api/emails/${id}/unarchive`, { method: 'PATCH' });
      if (res.ok) {
        setSelectedEmail(null);
        mutate();
        toast.success('Email restored from archive');
      } else {
        toast.error('Failed to restore email');
      }
    } catch {
      toast.error('Failed to restore email');
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen w-full overflow-hidden bg-gray-50">
      {/* Top Toolbar Row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived emails by email or subject..."
            className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={() => {
            mutate();
            setLastRefreshed(new Date());
          }}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 bg-white"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-green-500' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Last refreshed text */}
        {lastRefreshed && (
          <span className="text-xs text-gray-400 hidden md:inline whitespace-nowrap">
            Updated {formatTimeAgo(lastRefreshed)}
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden w-full relative">
        <div
          className={`flex flex-col h-full overflow-y-auto transition-all duration-300 ${
            selectedEmail ? 'w-full md:w-2/5 border-r border-gray-200 hidden md:flex' : 'w-full'
          }`}
        >
          {isLoading && emails.length === 0 ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 animate-pulse bg-gray-50 rounded-lg"
                >
                  <div className="w-24 h-4 bg-gray-200 rounded shrink-0"></div>
                  <div className="w-full h-4 bg-gray-200 rounded"></div>
                  <div className="w-16 h-4 bg-gray-200 rounded shrink-0"></div>
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Archive className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-gray-900 font-medium text-lg">No archived emails</h3>
              <p className="text-gray-500 text-sm mt-1">
                {debouncedSearch
                  ? 'No archived emails match your search.'
                  : 'Emails you archive will appear here.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col pb-20">
              {emails.map((job: EmailJob) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedEmail(job)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors duration-150 ${
                    selectedEmail?.id === job.id ? 'bg-green-50/50' : 'hover:bg-gray-50 bg-white'
                  }`}
                >
                  {/* Left: recipient */}
                  <div className="w-32 shrink-0">
                    <p className="text-sm text-gray-600 font-medium truncate">
                      To: {job.recipientEmail.split('@')[0]}
                    </p>
                  </div>

                  {/* Archived badge */}
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 shrink-0">
                    <Archive className="w-3 h-3 text-gray-500" />
                    <span>Archived {formatUpdatedTime(job.updatedAt || job.scheduledAt)}</span>
                  </div>

                  {/* Middle: subject + preview */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {job.subject || '(No Subject)'}
                    </span>
                    <span className="text-sm text-gray-400 truncate hidden sm:inline">
                      - {stripHtml(job.body).slice(0, 60)}
                    </span>
                  </div>

                  {/* Right: status badge & star */}
                  <div className="shrink-0 flex items-center gap-3">
                    <StatusBadge status={job.status} />
                    <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400 transition-colors" />
                  </div>
                </div>
              ))}

              {total > 20 && (
                <div className="p-4 flex items-center justify-center gap-4 text-sm text-gray-600 bg-white border-t border-gray-100 mt-auto">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="disabled:opacity-50 hover:text-gray-900"
                  >
                    ← Previous
                  </button>
                  <span>
                    Page {page} of {Math.ceil(total / 20)}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= Math.ceil(total / 20)}
                    className="disabled:opacity-50 hover:text-gray-900"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full Detail Panel when row clicked */}
        {selectedEmail && (
          <div className="w-full md:w-3/5 absolute md:relative inset-0 z-20 bg-white">
            <EmailDetailPanel
              email={selectedEmail}
              onClose={() => setSelectedEmail(null)}
              onDelete={handleDelete}
              onUnarchive={handleUnarchive}
            />
          </div>
        )}
      </div>
    </div>
  );
}
