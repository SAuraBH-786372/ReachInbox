'use client';

import React, { useState } from 'react';
import { ArrowLeft, Star, Archive, Trash2, X } from 'lucide-react';
import { EmailJob } from '@reachinbox/types';
import { StatusBadge } from './StatusBadge';

interface Props {
  email: EmailJob | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
}

function formatScheduledTime(dateStr: string | Date): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (date.toDateString() === now.toDateString()) {
    return `Today, ${timeStr}`;
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${timeStr}`;
  } else {
    return `${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}, ${timeStr}`;
  }
}

function formatSentTime(dateStr: string | Date): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EmailDetailPanel({ email, onClose, onDelete, onArchive, onUnarchive }: Props) {
  const [starred, setStarred] = useState(false);

  if (!email) return null;

  const recipientInitial = email.recipientEmail ? email.recipientEmail[0].toUpperCase() : 'U';

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header with actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        {/* Back/close */}
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 mr-1"
          title="Close"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Subject */}
        <h2 className="flex-1 text-sm font-medium text-gray-900 truncate">
          {email.subject || '(No Subject)'}
        </h2>

        {/* Action icons — match reference screenshot */}
        <div className="flex items-center gap-1">
          {/* Star */}
          <button
            onClick={() => setStarred(!starred)}
            className="p-1.5 rounded hover:bg-gray-100"
            title="Star"
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400 hover:text-gray-600'
              }`}
            />
          </button>

          {/* Archive / Unarchive */}
          <button
            onClick={() => {
              if (email.status === 'archived' && onUnarchive) {
                onUnarchive(email.id);
              } else {
                onArchive?.(email.id);
              }
            }}
            className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
              email.status === 'archived'
                ? 'text-green-600 bg-green-50 hover:bg-green-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title={email.status === 'archived' ? 'Unarchive (Restore)' : 'Archive'}
          >
            <Archive className="w-4 h-4" />
          </button>

          {/* Delete */}
          <button
            onClick={() => {
              if (confirm('Delete this email job?')) {
                onDelete?.(email.id);
              }
            }}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 ml-1"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Email meta */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-start gap-3">
          {/* Sender avatar */}
          <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white font-medium text-sm shrink-0">
            {recipientInitial}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {email.recipientEmail}
              </p>
              <StatusBadge status={email.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              To: {email.recipientEmail}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">
              {formatScheduledTime(email.scheduledAt)}
            </p>
            {email.sentAt && (
              <p className="text-xs text-green-500 mt-0.5">
                Sent {formatSentTime(email.sentAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Email body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div
          className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>

      {/* Footer with reference ID */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-400 font-mono">
          Job ID: {email.bullJobId?.slice(0, 20) || email.id}
        </p>
      </div>
    </div>
  );
}
