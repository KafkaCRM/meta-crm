import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Ability } from '@casl/ability';
import { buildTenantAbility } from '@meta-crm/permissions';
import type { TenantRoleEntry, TenantAbility } from '@meta-crm/permissions';
import { login as apiLogin, refreshToken as apiRefresh, logout as apiLogout } from '@/api/auth';
import { initAuthHelpers, apiCall } from '@/lib/api';
import { initSocket, disconnectSocket, onReconnecting, onDisconnect } from '@/lib/socket';
import { queryClient } from '@/lib/query-client';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  assignment_ids: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  ability: TenantAbility | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    ability: null,
    isAuthenticated: false,
    isLoading: false,
  });

  const login = useCallback(async (email: string, password: string, tenantSlug: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await apiLogin({ email, password, tenant_slug: tenantSlug });

      const roles: TenantRoleEntry[] = [{ role: result.user.role as TenantRoleEntry['role'] }];
      const ability = buildTenantAbility(roles, result.user.assignment_ids);

      setState({
        user: result.user,
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        ability,
        isAuthenticated: true,
        isLoading: false,
      });

      initSocket(result.access_token);
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
      throw new Error('INVALID_CREDENTIALS');
    }
  }, []);

  const logout = useCallback(async () => {
    if (state.accessToken) {
      await apiLogout(state.accessToken).catch(() => {});
    }
    disconnectSocket();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      ability: null,
      isAuthenticated: false,
      isLoading: false,
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

  useEffect(() => {
    onReconnecting(() => {
      queryClient.invalidateQueries();
    });
  }, []);

  useEffect(() => {
    onDisconnect(() => {
      // UI will show "Reconnecting..." via useRealtime hook
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
