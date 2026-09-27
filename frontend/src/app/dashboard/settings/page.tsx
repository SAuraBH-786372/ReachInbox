'use client';

import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import type { SlackStatus } from '@reachinbox/types';

export default function SettingsPage() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    // Check for ?slack=connected in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'connected') {
      toast.success('Slack connected successfully!');
      window.history.replaceState({}, '', '/dashboard/settings');
    }
    fetchSlackStatus();
  }, []);

  async function fetchSlackStatus() {
    setLoading(true);
    try {
      const res = await fetchApi('/api/slack/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false, channel: null, teamName: null });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetchApi('/api/slack/disconnect', { method: 'POST' });
      toast.success('Slack disconnected');
      await fetchSlackStatus();
    } catch {
      toast.error('Failed to disconnect Slack');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleConnect() {
    try {
      const res = await fetchApi('/api/slack/oauth/start');
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      } else {
        toast.error('Could not initiate Slack connection');
      }
    } catch (e) {
      toast.error('Could not reach backend');
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Integrations</p>

      <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-lg shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">#</span>
          </div>
          <h2 className="text-base font-medium text-gray-900">Slack Notifications</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Get notified when a sender hits its hourly send limit
        </p>

        {loading ? (
          <div className="animate-pulse h-8 bg-gray-100 rounded" />
        ) : status?.connected ? (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-green-600 font-medium">Connected</span>
            </div>
            {status.channel && <p className="text-sm text-gray-500">Posting to #{status.channel}</p>}
            {status.teamName && <p className="text-xs text-gray-400">{status.teamName}</p>}
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="mt-3 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-sm text-gray-500">Not connected</span>
            </div>
            <button
              onClick={handleConnect}
              className="bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg px-4 py-2 transition-colors shadow-sm"
            >
              Connect Slack
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
