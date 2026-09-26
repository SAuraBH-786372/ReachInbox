const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function fetchApi(path: string, options: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

export const api = {
  getHealth: () => fetchApi('/api/health'),
  getMe: () => fetchApi('/api/auth/me'),
  logout: () => fetchApi('/api/auth/logout', { method: 'POST' }),
  getSlackStatus: () => fetchApi('/api/slack/status'),
  disconnectSlack: () => fetchApi('/api/slack/disconnect', { method: 'POST' }),
  scheduleEmails: (payload: any) =>
    fetchApi('/api/emails/schedule', { method: 'POST', body: JSON.stringify(payload) }),
  getScheduledEmails: (page: number, search: string) =>
    fetchApi(`/api/emails/scheduled?page=${page}&search=${search}`),
  getSentEmails: (page: number, search: string) =>
    fetchApi(`/api/emails/sent?page=${page}&search=${search}`),
  getSenders: () => fetchApi('/api/senders'),
  createEtherealSender: () => fetchApi('/api/senders/create-ethereal', { method: 'POST' }),
};
