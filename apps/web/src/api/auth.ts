export interface LoginRequest {
  email: string;
  password: string;
  tenant_slug: string;
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

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, unknown>)?.['code'] as string ?? response.statusText,
    );
  }

  return response.json() as Promise<LoginResponse>;
}

export async function refreshToken(token: string): Promise<RefreshResponse> {
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: token }),
  });

  if (!response.ok) {
    throw new Error('REFRESH_TOKEN_INVALID');
  }

  return response.json() as Promise<RefreshResponse>;
}

export async function logout(token: string): Promise<void> {
  const response = await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}
