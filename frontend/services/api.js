export const API_URL = 'http://localhost:5000';

export async function api(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  } else {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const controller = new AbortController();
  const timeoutMs = options.timeout || 25000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const combinedSignal = options.signal
    ? combineAbortSignals(controller.signal, options.signal)
    : controller.signal;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers, signal: combinedSignal });
    clearTimeout(timeout);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function combineAbortSignals(...signals) {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) { controller.abort(signal.reason); return controller.signal; }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export const MOCK_FEED = [];

export async function getFeed(params = {}) {
  const { type, ...rest } = params;
  let endpoint = '/videos/feed';
  if (type === 'trending') endpoint = '/videos/feed/trending';
  else if (type === 'following') endpoint = '/videos/feed/following';
  const qs = new URLSearchParams(rest).toString();
  try {
    return await api(`${endpoint}?${qs}`);
  } catch {
    return MOCK_FEED;
  }
}
