import { fetchApi } from './api';

export const fetcher = async (url: string) => {
  const res = await fetchApi(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Request failed with status ${res.status}`);
  }
  return res.json();
};
