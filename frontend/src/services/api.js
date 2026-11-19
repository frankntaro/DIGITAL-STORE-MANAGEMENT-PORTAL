import {
  enqueueOfflineTransaction,
  getAllFromStore,
  getDeviceId,
  getOfflineQueue,
  saveBootstrapCache,
  updateQueueItemStatus,
} from './offlineDb';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Lightweight in-memory GET micro-cache & in-flight request deduplication
const GET_CACHE_TTL_MS = 8000;
const REQUEST_TIMEOUT_MS = 20000;
const getResponseCache = new Map();
const inFlightGets = new Map();

export function clearApiCache() {
  getResponseCache.clear();
  inFlightGets.clear();
}

export function emitConnectivityStatus(online) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('esms:connectivity', { detail: { online: Boolean(online) } }));
  }
}

/**
 * Verifies real end-to-end connectivity to the backend API (/health)
 * rather than relying solely on navigator.onLine.
 */
export async function checkServerConnectivity(timeoutMs = 4000) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emitConnectivityStatus(false);
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const reachable = res.ok;
    emitConnectivityStatus(reachable);
    return reachable;
  } catch {
    emitConnectivityStatus(false);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function resolveMediaUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/uploads/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  return trimmed;
}

export function getAuthToken() {
  return localStorage.getItem('esms_token');
}

export function setAuthToken(token) {
  clearApiCache();
  if (token) {
    localStorage.setItem('esms_token', token);
  } else {
    localStorage.removeItem('esms_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const { fresh = false, timeout = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const method = String(fetchOptions.method || 'GET').toUpperCase();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${normalizedEndpoint}`;
  const token = getAuthToken();

  // Invalidate cached GET reads immediately on any data-mutating request
  if (method !== 'GET') {
    clearApiCache();
  }

  const cacheKey = `${token || 'anon'}::${url}`;
  const isCacheableGet = method === 'GET' && !fresh && !normalizedEndpoint.startsWith('/auth/me');

  if (isCacheableGet) {
    const cached = getResponseCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < GET_CACHE_TTL_MS) {
      return cached.data;
    }
    if (inFlightGets.has(cacheKey)) {
      return inFlightGets.get(cacheKey);
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers || {}),
  };

  const execute = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        method,
        headers,
        signal: fetchOptions.signal || controller.signal,
      });

      // Server responded over network -> confirm online status automatically
      emitConnectivityStatus(true);

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        const err = new Error(data.message || `Request failed with status ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      if (isCacheableGet) {
        getResponseCache.set(cacheKey, { data, ts: Date.now() });
      }
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') {
        emitConnectivityStatus(false);
        const timeoutErr = new Error('Request timed out. Please check your connection and try again.');
        timeoutErr.isNetworkError = true;
        throw timeoutErr;
      }
      if (!err?.status) {
        emitConnectivityStatus(false);
        err.isNetworkError = true;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (isCacheableGet) {
        inFlightGets.delete(cacheKey);
      }
    }
  };

  const promise = execute();
  if (isCacheableGet) {
    inFlightGets.set(cacheKey, promise);
  }
  return promise;
}

export async function uploadImageFile(file) {
  clearApiCache();
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('image', file, file.name || 'product.jpg');

  const headers = {
    'X-Device-Id': getDeviceId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const err = new Error(data.message || `Request failed with status ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function refreshOfflineBootstrap() {
  try {
    const data = await apiRequest('/sync/bootstrap', { fresh: true });
    await saveBootstrapCache(data);
    return data;
  } catch {
    return null;
  }
}

export async function synchronizeOfflineQueue() {
  const queue = await getOfflineQueue();
  const pending = queue.filter((item) => item.status === 'pending' || item.status === 'conflict');
  if (pending.length === 0) {
    return { synced: 0, results: [] };
  }

  const response = await apiRequest('/sync/push', {
    method: 'POST',
    body: JSON.stringify({ transactions: pending }),
  });

  const results = response.results || [];
  for (const res of results) {
    await updateQueueItemStatus(res.uuid, res.status, res.message, res.receipt_number);
  }

  await refreshOfflineBootstrap();
  return { synced: results.length, results };
}

export async function fetchProductsWithOfflineFallback(queryParams = '') {
  try {
    const res = await apiRequest(`/products${queryParams}`);
    return { products: res.products || [], offline: false };
  } catch (err) {
    if (err.status === 401 || err.status === 403) throw err;
    const cached = await getAllFromStore('products');
    return { products: cached, offline: true };
  }
}

export { enqueueOfflineTransaction, getAllFromStore, getOfflineQueue };
