export interface LoginRequest {
  email: string;
  password: string;
  tenant_slug?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    assignment_ids: string[];
  };
}

export interface MultipleWorkspacesResponse {
  multiple_workspaces: true;
  workspaces: {
    slug: string;
    name: string;
  }[];
}

export type LoginResult = LoginResponse | MultipleWorkspacesResponse;

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
}

export async function login(data: LoginRequest): Promise<LoginResult> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, unknown>)?.['code'] as string ?? response.statusText,
    );
  }

  return response.json() as Promise<LoginResult>;
}

export async function refreshToken(token?: string): Promise<RefreshResponse> {
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(token ? { refresh_token: token } : {}),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('REFRESH_TOKEN_INVALID');
  }

  return response.json() as Promise<RefreshResponse>;
}

export async function logout(token?: string): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(token ? { refresh_token: token } : {}),
    credentials: 'include',
  });
}
