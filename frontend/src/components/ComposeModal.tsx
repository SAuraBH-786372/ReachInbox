'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetchApi } from '@/lib/api';
import { fetcher } from '@/lib/fetcher';
import { useToast } from '@/components/ToastProvider';
import { X, Paperclip, Clock } from 'lucide-react';
import { Sender } from '@reachinbox/types';

interface ComposeModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ComposeModal({ onClose, onSuccess }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');

  const [senderId, setSenderId] = useState('');
  // BUG 1 (B): Default time is always set on mount
  const [selectedSlot, setSelectedSlot] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d;
  });
  const [delay, setDelay] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attachment state (Fix 5)
  const attachmentRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Schedule panel visibility toggle (Fix 6)
  const [showSchedulePanel, setShowSchedulePanel] = useState(true);

  function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (attachmentRef.current) {
      attachmentRef.current.value = '';
    }
  }

  // Body editor with contentEditable (BUG 2 & 4)
  const bodyRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState('');

  const { toast } = useToast();
  const { mutate } = useSWRConfig();

  // SWR for senders
  const { data: senders, isLoading: sendersLoading } = useSWR<Sender[]>('/api/senders', fetcher);

  // Auto-create ethereal sender on compose open if none exist
  useEffect(() => {
    if (senders && senders.length === 0) {
      fetchApi('/api/senders/create-ethereal', { method: 'POST' })
        .then((r) => r.json())
        .then(() => mutate('/api/senders'))
        .catch(console.error);
    }
  }, [senders, mutate]);

  // Auto-select first sender when loaded
  useEffect(() => {
    if (senders && senders.length > 0 && !senderId) {
      setSenderId(senders[0].id);
    }
  }, [senders, senderId]);

  // Active sender fallback (ensures senderId is never empty if senders list has arrived)
  const effectiveSenderId = useMemo(() => {
    return senderId || (senders && senders.length > 0 ? senders[0].id : '');
  }, [senderId, senders]);

  // Active recipients: includes committed chip recipients AND any valid email currently in emailInput
  const pendingEmail = emailInput.trim().replace(/[,;]/g, '');
  const isValidPendingEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingEmail);
  const effectiveRecipients = useMemo(() => {
    return Array.from(
      new Set([
        ...recipients,
        ...(isValidPendingEmail ? [pendingEmail] : []),
      ])
    );
  }, [recipients, isValidPendingEmail, pendingEmail]);

  // Submit button state validation (BUG 1, D)
  const canSubmit = Boolean(
    effectiveSenderId &&
    subject.trim().length > 0 &&
    effectiveRecipients.length > 0 &&
    !isSubmitting
  );

  const handleCreateSender = async () => {
    try {
      const res = await fetchApi('/api/senders/create-ethereal', { method: 'POST' });
      if (res.ok) {
        const newSender = await res.json();
        if (newSender?.id) {
          setSenderId(newSender.id);
        }
        toast.success('Test sender created');
        mutate('/api/senders');
      } else {
        toast.error('Failed to create sender');
      }
    } catch {
      toast.error('Failed to create sender');
    }
  };

  // Helper to commit an email string to recipients array
  const commitEmail = (raw: string) => {
    const cleaned = raw.trim().replace(/[,;]/g, '');
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setRecipients((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
      setEmailInput('');
      return true;
    }
    return false;
  };

  // BUG 2: Rich text formatting with focus & timeout for lists and styling
  function execFormat(command: string, value?: string) {
    bodyRef.current?.focus();
    setTimeout(() => {
      document.execCommand(command, false, value ?? undefined);
      setBody(bodyRef.current?.innerHTML || '');
    }, 0);
  }

  const toolbarActions = [
    { icon: '↩', cmd: 'undo', title: 'Undo' },
    { icon: '↪', cmd: 'redo', title: 'Redo' },
    { icon: 'B', cmd: 'bold', title: 'Bold', style: 'font-bold' },
    { icon: 'I', cmd: 'italic', title: 'Italic', style: 'italic' },
    { icon: 'U', cmd: 'underline', title: 'Underline', style: 'underline' },
    { icon: 'S', cmd: 'strikeThrough', title: 'Strikethrough' },
    { icon: '≡L', cmd: 'justifyLeft', title: 'Align Left' },
    { icon: '≡C', cmd: 'justifyCenter', title: 'Align Center' },
    { icon: '≡R', cmd: 'justifyRight', title: 'Align Right' },
    { icon: '•', cmd: 'insertUnorderedList', title: 'Bullet List' },
    { icon: '1.', cmd: 'insertOrderedList', title: 'Numbered List' },
  ];

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (emailInput.trim()) {
        e.preventDefault();
        commitEmail(emailInput);
      }
    } else if (e.key === 'Backspace' && emailInput === '' && recipients.length > 0) {
      setRecipients((prev) => prev.slice(0, -1));
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const parseCSV = (text: string) => {
    const emails = text.split(/[\n,;]+/).map((e) => e.trim());
    return emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      const newRecipients = Array.from(new Set([...recipients, ...parsed]));
      setRecipients(newRecipients);
      toast.success(`Added ${parsed.length} emails`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const generateTimeSlots = () => {
    const slots = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const times = [9, 12, 15, 18]; // 9 AM, 12 PM, 3 PM, 6 PM

    for (const hour of times) {
      const d = new Date(tomorrow);
      d.setHours(hour, 0, 0, 0);
      slots.push({
        label: `Tomorrow, ${hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}`,
        date: d,
      });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Submit handler (BUG 1, Step 2)
  async function handleSubmit() {
    // Automatically commit any valid email remaining in the input field
    const finalRecipients = [...effectiveRecipients];
    if (isValidPendingEmail && !recipients.includes(pendingEmail)) {
      setRecipients(finalRecipients);
      setEmailInput('');
    }

    const finalSenderId = effectiveSenderId;

    if (!finalSenderId) {
      const msg = 'Please select or create a sender in the From field';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (finalRecipients.length === 0) {
      const msg = 'Please enter at least one recipient email';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!subject.trim()) {
      const msg = 'Please enter an email subject';
      setError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetchApi('/api/emails/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: finalSenderId,
          subject: subject.trim(),
          body: body || subject,
          recipients: finalRecipients,
          scheduledAt: selectedSlot.toISOString(),
          minDelaySeconds: delay,
          maxEmailsPerHour: hourlyLimit,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Failed to schedule emails (${response.status})`);
      }

      const result = await response.json();
      toast.success(`${finalRecipients.length} email${finalRecipients.length !== 1 ? 's' : ''} scheduled!`);
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/emails/scheduled'));
      mutate('/api/emails/scheduled');
      onClose();
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const recipientCount = effectiveRecipients.length;

  return (
    <div className="fixed inset-0 bg-white z-50 flex">
      {/* Hidden file input (Fix 5) */}
      <input
        ref={attachmentRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.txt"
        className="hidden"
        onChange={handleAttachment}
      />

      {/* LEFT COLUMN */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-200 ${
          showSchedulePanel ? 'border-r border-gray-200' : ''
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={onClose} className="text-gray-600 hover:text-gray-900 mr-3 text-lg font-bold">
              &larr;
            </button>
            <span className="text-sm font-medium text-gray-900">Compose New Email</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Attachment icon button (Fix 5) */}
            <button
              type="button"
              onClick={() => attachmentRef.current?.click()}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Replace gear/settings icon with clock (Fix 6) */}
            <button
              type="button"
              onClick={() => setShowSchedulePanel(!showSchedulePanel)}
              className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                showSchedulePanel
                  ? 'text-green-500 bg-green-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Schedule time"
            >
              <Clock className="w-4 h-4" />
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              className={`bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-1.5 rounded-md ml-1 transition-colors ${
                !canSubmit ? 'opacity-50 cursor-not-allowed hover:bg-green-500' : ''
              }`}
            >
              {isSubmitting ? 'Scheduling...' : 'Send Later'}
            </button>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
          {/* From Field */}
          <div className="flex items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-16 shrink-0">From:</span>
            {sendersLoading ? (
              <span className="text-gray-400 text-sm">Loading senders...</span>
            ) : senders && senders.length > 0 ? (
              <div className="bg-gray-100 rounded-full px-3 py-1 flex items-center gap-2 text-sm text-gray-700">
                <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600 font-medium">
                  {senders.find((s) => s.id === effectiveSenderId)?.email.charAt(0).toUpperCase() || 'S'}
                </div>
                <select
                  value={effectiveSenderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="border-none outline-none text-sm text-gray-700 bg-transparent cursor-pointer"
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.email}
                    </option>
                  ))}
                </select>
                <span className="text-gray-400 text-xs">▼</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCreateSender}
                className="text-green-500 text-sm underline"
              >
                Create test sender
              </button>
            )}
          </div>

          {/* To Field */}
          <div className="flex items-start py-2 border-b border-gray-100 min-h-[44px]">
            <span className="text-sm text-gray-500 w-16 shrink-0 mt-1.5">To:</span>
            <div className="flex-1 flex flex-wrap gap-1 items-center min-w-0">
              {recipients.map((r) => (
                <div
                  key={r}
                  className="bg-green-100 text-green-800 text-xs rounded-full px-2.5 py-1 flex items-center gap-1.5 my-0.5"
                >
                  <span className="truncate max-w-[150px]">{r}</span>
                  <X className="w-3 h-3 cursor-pointer hover:text-green-900" onClick={() => removeRecipient(r)} />
                </div>
              ))}
              <input
                type="text"
                value={emailInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(',') || val.includes(';') || val.includes(' ')) {
                    const parts = val.split(/[,;\s]+/);
                    parts.forEach((p) => {
                      if (p.trim()) commitEmail(p);
                    });
                  } else {
                    setEmailInput(val);
                  }
                }}
                onBlur={() => {
                  if (emailInput.trim()) {
                    commitEmail(emailInput);
                  }
                }}
                onKeyDown={handleEmailKeyDown}
                placeholder={recipients.length === 0 ? 'recipient@example.com (press Enter)' : 'Add more...'}
                className="border-none outline-none text-sm flex-1 min-w-[150px] py-1 bg-transparent text-gray-700 placeholder-gray-400"
              />
            </div>
            <div className="ml-3 shrink-0 mt-1">
              <label className="text-green-500 text-sm underline cursor-pointer hover:text-green-600">
                Upload list
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
              {recipientCount > 0 && (
                <span className="text-xs text-gray-400 ml-2">({recipientCount} added)</span>
              )}
            </div>
          </div>

          {/* Subject Field */}
          <div className="flex items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-16 shrink-0">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 border-none outline-none text-sm text-gray-900 bg-transparent placeholder-gray-400"
            />
          </div>

          {/* Delay & Hourly Limit */}
          <div className="flex items-center gap-6 py-3 border-b border-gray-100 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Delay between 2 emails (s):</span>
              <input
                type="number"
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value, 10) || 0)}
                min="0"
                className="w-16 border border-gray-200 rounded px-2 py-1 text-center outline-none focus:border-green-500 text-gray-700"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Hourly Limit:</span>
              <input
                type="number"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 0)}
                min="1"
                className="w-16 border border-gray-200 rounded px-2 py-1 text-center outline-none focus:border-green-500 text-gray-700"
              />
            </div>
          </div>

          {/* Toolbar (BUG 2) */}
          <div className="flex items-center gap-1 py-2 px-2 border-t border-b border-gray-100 flex-wrap">
            {toolbarActions.map((action) => (
              <button
                key={action.cmd}
                type="button"
                title={action.title}
                onMouseDown={(e) => {
                  e.preventDefault(); // CRITICAL: prevents editor blur before execCommand
                  execFormat(action.cmd);
                }}
                className={`p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-900 text-sm min-w-[28px] text-center ${
                  action.style || ''
                }`}
              >
                {action.icon}
              </button>
            ))}
          </div>

          {/* Show attached files below the toolbar (Fix 5) */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
              {attachments.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-600"
                >
                  <Paperclip className="w-3 h-3 text-gray-400" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-gray-600 ml-1 text-sm font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ContentEditable body editor (BUG 2) */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => setBody(bodyRef.current?.innerHTML || '')}
            className="flex-1 min-h-48 px-3 py-3 outline-none text-sm text-gray-700 leading-relaxed overflow-y-auto"
            style={{
              minHeight: '200px',
              listStyleType: 'disc',
              paddingLeft: '0',
            }}
            data-placeholder="Type your message here..."
          />
        </div>
      </div>

      {/* RIGHT COLUMN (Fix 6: toggled by Clock icon) */}
      <div
        className={`w-64 lg:w-72 shrink-0 border-l border-gray-200 flex flex-col bg-white transition-all duration-200 ${
          showSchedulePanel ? 'flex' : 'hidden'
        }`}
      >
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Send Later</h2>
        </div>

        <div className="px-4 py-4 flex-1 overflow-y-auto">
          {timeSlots.map((slot, idx) => {
            const isSelected = selectedSlot?.getTime() === slot.date.getTime();
            return (
              <div
                key={idx}
                onClick={() => setSelectedSlot(slot.date)}
                className={`border rounded-lg px-3 py-3 mb-3 text-sm cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {slot.label}
              </div>
            );
          })}

          <div className="mt-6">
            <label className="text-xs text-gray-500 block mb-2 font-medium">Custom time:</label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 text-gray-700"
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedSlot(new Date(e.target.value));
                }
              }}
            />
          </div>
        </div>

        <div className="px-4 py-4 border-t border-gray-200 flex flex-col gap-2">
          {error && <div className="text-xs text-red-500 mb-1">{error}</div>}
          {!canSubmit && (
            <div className="text-[11px] text-gray-400 text-right mb-1">
              {!effectiveSenderId
                ? '• Missing sender'
                : recipientCount === 0
                ? '• Add a recipient email'
                : !subject.trim()
                ? '• Enter a subject'
                : ''}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              className={`bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors flex items-center justify-center min-w-[80px] ${
                !canSubmit ? 'opacity-50 cursor-not-allowed hover:bg-green-500' : ''
              }`}
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                `Schedule ${recipientCount > 0 ? recipientCount : 1} Email${recipientCount > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
