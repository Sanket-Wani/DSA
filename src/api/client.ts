// Centralized API Client

let currentUserId = 1; // Default to Superadmin (id: 1) or Team (id: 2)

export function setCurrentUserId(id: number) {
  currentUserId = id;
}

export function getCurrentUserId(): number {
  return currentUserId;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('x-user-id', String(currentUserId));

  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

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

  return response.json();
}
