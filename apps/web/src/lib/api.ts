let getAccessToken: (() => string | null) | null = null;
let setTokens: ((access: string, refresh?: string) => void) | null = null;
let doRefresh: (() => Promise<string | null>) | null = null;
let doLogout: (() => void) | null = null;

export function initAuthHelpers(
  helpers: {
    getAccessToken: () => string | null;
    setTokens: (access: string, refresh?: string) => void;
    doRefresh: () => Promise<string | null>;
    doLogout: () => void;
  },
) {
  getAccessToken = helpers.getAccessToken;
  setTokens = helpers.setTokens;
  doRefresh = helpers.doRefresh;
  doLogout = helpers.doLogout;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function flushPendingRequests(token: string) {
  pendingRequests.forEach(({ resolve }) => resolve(token));
  pendingRequests = [];
}

function rejectPendingRequests(err: unknown) {
  pendingRequests.forEach(({ reject }) => reject(err));
  pendingRequests = [];
}

async function getValidToken(): Promise<string | null> {
  if (!getAccessToken) return null;

  const token = getAccessToken();
  if (token) return token;

  if (!doRefresh) return null;

  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      pendingRequests.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    refreshPromise = doRefresh();
    const newToken = await refreshPromise;

    if (newToken) {
      flushPendingRequests(newToken);
      return newToken;
    }

    rejectPendingRequests(null);
    return null;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

export async function apiCall<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getValidToken();

  if (!token) {
    doLogout?.();
    throw new ApiError(401, 'UNAUTHORIZED', 'No valid token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(init?.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    const refreshed = await getValidToken();
    if (!refreshed) {
      doLogout?.();
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired');
    }

    headers.Authorization = `Bearer ${refreshed}`;
    const retryResponse = await fetch(`/api/v1${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    return handleResponse<T>(retryResponse);
  }

  return handleResponse<T>(response);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as Record<string, unknown>)?.['code'] as string ?? 'UNKNOWN',
      (body as Record<string, unknown>)?.['message'] as string ?? response.statusText,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
