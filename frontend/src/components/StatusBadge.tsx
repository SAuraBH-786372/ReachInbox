import React from 'react';
import { tokens } from '@/styles/tokens';

export type StatusType = 'scheduled' | 'processing' | 'sent' | 'failed' | 'archived';

export function StatusBadge({ status }: { status: StatusType | string }) {
  const colors = (tokens.statusColors as any)[status] || { bg: '#F3F4F6', text: '#6B7280' };
  
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.text }} />
      {status}
    </span>
  );
}
