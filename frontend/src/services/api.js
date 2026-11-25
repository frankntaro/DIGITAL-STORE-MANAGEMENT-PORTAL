import {
  enqueueOfflineTransaction,
  getAllFromStore,
  getDeviceId,
  getOfflineQueue,
  saveBootstrapCache,
  updateQueueItemStatus,
} from './offlineDb';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000/api');
export const API_ORIGIN = API_BASE.startsWith('http') ? API_BASE.replace(/\/api\/?$/, '') : '';

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
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  // Normalize accidental localhost / 127.0.0.1 uploaded paths so phones load them from the live origin
  const localUploadMatch = trimmed.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(\/uploads\/.+)$/i);
  if (localUploadMatch) {
    return `${API_ORIGIN}${localUploadMatch[1]}`;
  }
  if (trimmed.startsWith('/uploads/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  if (trimmed.startsWith('uploads/')) {
    return `${API_ORIGIN}/${trimmed}`;
  }
  // Prevent mixed-content blocking on mobile browsers when app runs over HTTPS
  if (
    typeof window !== 'undefined' &&
    window.location?.protocol === 'https:' &&
    trimmed.startsWith('http://') &&
    trimmed.includes(window.location.host)
  ) {
    return `https://${trimmed.slice(7)}`;
  }
  return trimmed;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read cached image blob'));
    reader.readAsDataURL(blob);
  });
}

let cachedMediaSyncRunning = false;

/**
 * Silently recovers any /uploads/img_* product photos still present in this browser's
 * Service Worker cache (e.g. on the PC that originally uploaded them before Render redeployed)
 * into persistent MySQL storage so all phones & devices immediately see them.
 */
export async function syncCachedMediaToServer() {
  if (cachedMediaSyncRunning || typeof window === 'undefined') {
    return;
  }
  if (!getAuthToken() || navigator.onLine === false) return;
  cachedMediaSyncRunning = true;
  try {
    const cachedEntries = new Map();
    const candidateFilenames = new Set();

    // 1. Collect /uploads/img_* filenames from Service Worker media caches
    if (typeof caches !== 'undefined') {
      const cacheNames = await caches.keys();
      const mediaCacheNames = cacheNames.filter((n) => n.includes('media'));
      for (const cName of mediaCacheNames) {
        const cache = await caches.open(cName);
        const keys = await cache.keys();
        for (const req of keys) {
          try {
            const u = new URL(req.url);
            const match = u.pathname.match(/^\/uploads\/(img_[0-9]+_[a-f0-9]+\.(?:jpg|jpeg|png|webp|gif|svg|bmp|avif))$/i);
            if (match) {
              candidateFilenames.add(match[1]);
              if (!cachedEntries.has(match[1])) {
                cachedEntries.set(match[1], { cache, req });
              }
            }
          } catch {
            // ignore malformed URL
          }
        }
      }
    }

    // 2. Also inspect products' /uploads/img_* filenames (recovers from standard browser HTTP disk cache too!)
    try {
      const prodRes = await apiRequest('/products');
      for (const p of prodRes?.products || []) {
        const raw = String(p?.image_url || '').trim();
        const m = raw.match(/\/uploads\/(img_[0-9]+_[a-f0-9]+\.(?:jpg|jpeg|png|webp|gif|svg|bmp|avif))$/i);
        if (m) candidateFilenames.add(m[1]);
      }
    } catch {
      // ignore if products list unavailable
    }

    const filenames = Array.from(candidateFilenames);
    if (filenames.length === 0) return;

    const checkRes = await apiRequest('/media/check-missing', {
      method: 'POST',
      body: JSON.stringify({ filenames }),
    });
    const missing = Array.isArray(checkRes?.missing) ? checkRes.missing : [];
    if (missing.length === 0) return;

    for (const fn of missing) {
      try {
        let resp = null;
        const entry = cachedEntries.get(fn);
        if (entry) {
          resp = await entry.cache.match(entry.req);
        }
        if ((!resp || !resp.ok) && window.location?.origin) {
          // Try browser's built-in HTTP disk cache without making a network request
          resp = await fetch(`${API_ORIGIN}/uploads/${fn}`, {
            cache: 'only-if-cached',
            mode: 'same-origin',
          }).catch(() => null);
        }
        if (!resp || !resp.ok) continue;
        const blob = await resp.blob();
        if (!blob || blob.size === 0 || blob.size > 7 * 1024 * 1024) continue;
        const base64 = await blobToDataUrl(blob);
        if (!base64) continue;
        await apiRequest('/media/restore', {
          method: 'POST',
          body: JSON.stringify({ filename: fn, base64 }),
        });
      } catch {
        // non-fatal per image
      }
    }
  } catch {
    // silent background recovery
  } finally {
    cachedMediaSyncRunning = false;
  }
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
