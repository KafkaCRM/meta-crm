import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { buildPlatformAbility } from '@meta-crm/permissions';
import type { PlatformAbility } from '@meta-crm/permissions';
import { PlatformRole } from '@meta-crm/types';
import { platformLogin as apiLogin, refreshToken as apiRefresh, logout as apiLogout } from '@/api/auth';
import { initAuthHelpers } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

const RT_KEY = 'meta_crm_admin_rt';
const USER_KEY = 'meta_crm_admin_user';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  platform_role: PlatformRole;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  ability: PlatformAbility | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isUnauthorized: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    if (!decoded) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedRT = localStorage.getItem(RT_KEY);

  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: storedRT,
    ability: null,
    isAuthenticated: false,
    // Show loading while we attempt a silent refresh on boot.
    isLoading: !!storedRT,
    isUnauthorized: false,
  });

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await apiLogin({ email, password });

      const payload = decodeJwtPayload(result.access_token);
      if (!payload || !payload.platform_role) {
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          ability: null,
          isAuthenticated: false,
          isLoading: false,
          isUnauthorized: true,
        });
        return;
      }

      const platformRole = payload.platform_role as PlatformRole;
      const ability = buildPlatformAbility(platformRole);

      const user: AuthUser = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        platform_role: platformRole,
      };

      // Persist session so it survives page refreshes.
      localStorage.setItem(RT_KEY, result.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setState({
        user,
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        ability,
        isAuthenticated: true,
        isLoading: false,
        isUnauthorized: false,
      });
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
      throw new Error('INVALID_CREDENTIALS');
    }
  }, []);

  const logout = useCallback(async () => {
    if (state.accessToken) {
      await apiLogout(state.accessToken).catch(() => {});
    }
    // Clear persisted session.
    localStorage.removeItem(RT_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      ability: null,
      isAuthenticated: false,
      isLoading: false,
      isUnauthorized: false,
    });
    queryClient.clear();
  }, [state.accessToken]);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (!state.refreshToken) return null;
    try {
      const result = await apiRefresh(state.refreshToken);
      setState((s) => ({ ...s, accessToken: result.access_token }));
      return result.access_token;
    } catch {
      await logout();
      return null;
    }
  }, [state.refreshToken, logout]);

  // Boot-time silent restore: exchange a stored refresh token for a fresh
  // access token before the router renders any protected route.
  useEffect(() => {
    const storedToken = localStorage.getItem(RT_KEY);
    if (!storedToken) return;

    const storedUser = readStoredUser();

    apiRefresh(storedToken)
      .then((result) => {
        if (!storedUser) throw new Error('no_user');

        const ability = buildPlatformAbility(storedUser.platform_role);

        setState({
          user: storedUser,
          accessToken: result.access_token,
          refreshToken: storedToken,
          ability,
          isAuthenticated: true,
          isLoading: false,
          isUnauthorized: false,
        });
      })
      .catch(() => {
        // Stored token is stale / invalid — clear and go to login.
        localStorage.removeItem(RT_KEY);
        localStorage.removeItem(USER_KEY);
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          ability: null,
          isAuthenticated: false,
          isLoading: false,
          isUnauthorized: false,
        });
      });

    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initAuthHelpers({
      getAccessToken: () => state.accessToken,
      setTokens: (access, refresh) => {
        setState((s) => ({ ...s, accessToken: access, refreshToken: refresh }));
      },
      doRefresh: refresh,
      doLogout: logout,
    });
  }, [state.accessToken, refresh, logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
