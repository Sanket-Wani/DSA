// Centralized API Client

let currentUserId = 1; // Default to Superadmin (id: 1) or Team (id: 2)

export function setCurrentUserId(id: number) {
  currentUserId = id;
}

export function getCurrentUserId(): number {
  return currentUserId;
}

// Master data endpoints that rarely change and can be safely cached in memory for 5 minutes
const CACHEABLE_MASTER_DATA = [
  '/api/products',
  '/api/banks',
  '/api/firms',
  '/api/users/sales-team',
  '/api/accounts/receiving-banks',
  '/api/voucher-types'
];

const masterDataCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateMasterDataCache() {
  masterDataCache.clear();
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Check in-memory master data cache for instant responses (0 ms)
  if (method === 'GET') {
    const isCacheable = CACHEABLE_MASTER_DATA.some(route => url === route || url.startsWith(`${route}?`));
    if (isCacheable) {
      const cached = masterDataCache.get(url);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return Promise.resolve(JSON.parse(JSON.stringify(cached.data)) as T);
      }
    }
  }

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('x-user-id', String(currentUserId));

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      errorMsg = data.error || errorMsg;
    } catch {
      // response wasn't json
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();

  // If this was a GET on a cacheable route, store in master data cache
  if (method === 'GET') {
    const isCacheable = CACHEABLE_MASTER_DATA.some(route => url === route || url.startsWith(`${route}?`));
    if (isCacheable) {
      masterDataCache.set(url, { timestamp: Date.now(), data: result });
    }
  } else if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    // Invalidate master data cache on any mutation
    masterDataCache.clear();
  }

  return result;
}
