export interface PlatformLoginRequest {
  email: string;
  password: string;
}

export interface PlatformLoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    platform_role: string;
  };
}

export interface RefreshResponse {
  access_token: string;
}

export async function platformLogin(data: PlatformLoginRequest): Promise<PlatformLoginResponse> {
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

  return response.json() as Promise<PlatformLoginResponse>;
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

export async function logout(accessToken: string, refreshToken: string): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

