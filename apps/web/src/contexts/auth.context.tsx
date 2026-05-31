import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Ability } from '@casl/ability';
import { buildTenantAbility } from '@meta-crm/permissions';
import type { TenantRoleEntry, TenantAbility } from '@meta-crm/permissions';
import { login as apiLogin, refreshToken as apiRefresh, logout as apiLogout } from '@/api/auth';
import { initAuthHelpers, apiCall } from '@/lib/api';
import { initSocket, disconnectSocket, onReconnecting, onDisconnect } from '@/lib/socket';
import { queryClient } from '@/lib/query-client';

const LOGGED_IN_KEY = 'meta_crm_logged_in';
const USER_KEY = 'meta_crm_user';

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
  ability: TenantAbility | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
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
  const isPreviouslyLoggedIn = localStorage.getItem(LOGGED_IN_KEY) === 'true';

  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    ability: null,
    isAuthenticated: false,
    // Show a loading screen while we attempt a silent token refresh on boot.
    isLoading: isPreviouslyLoggedIn,
  });

  const login = useCallback(async (email: string, password: string, tenantSlug?: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await apiLogin({ email, password, tenant_slug: tenantSlug });

      const roles: TenantRoleEntry[] = [{ role: result.user.role as TenantRoleEntry['role'] }];
      const ability = buildTenantAbility(roles, result.user.assignment_ids);

      // Persist session indicator so it survives page refreshes.
      localStorage.setItem(LOGGED_IN_KEY, 'true');
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));

      // Clear React Query cache so the new user session starts fresh
      queryClient.clear();

      setState({
        user: result.user,
        accessToken: result.access_token,
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
    try {
      await apiLogout(state.accessToken || undefined);
    } catch {}
    localStorage.removeItem(LOGGED_IN_KEY);
    localStorage.removeItem(USER_KEY);
    disconnectSocket();
    setState({
      user: null,
      accessToken: null,
      ability: null,
      isAuthenticated: false,
      isLoading: false,
    });
    queryClient.clear();
  }, [state.accessToken]);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (localStorage.getItem(LOGGED_IN_KEY) !== 'true') return null;
    try {
      const result = await apiRefresh();
      setState((s) => ({ ...s, accessToken: result.access_token }));
      return result.access_token;
    } catch {
      await logout();
      return null;
    }
  }, [logout]);

  // Boot-time silent restore: if a refresh token is stored, exchange it for
  // a new access token and rehydrate auth state — all before the router
  // renders a protected route.
  useEffect(() => {
    const isLogged = localStorage.getItem(LOGGED_IN_KEY) === 'true';
    if (!isLogged) return;

    const storedUser = readStoredUser();

    apiRefresh()
      .then((result) => {
        if (!storedUser) {
          // No cached user — can't restore fully, force re-login.
          throw new Error('no_user');
        }

        const roles: TenantRoleEntry[] = [{ role: storedUser.role as TenantRoleEntry['role'] }];
        const ability = buildTenantAbility(roles, storedUser.assignment_ids);

        setState({
          user: storedUser,
          accessToken: result.access_token,
          ability,
          isAuthenticated: true,
          isLoading: false,
        });

        initSocket(result.access_token);
      })
      .catch(() => {
        // Stored token is stale / invalid — clear everything and send to login.
        localStorage.removeItem(LOGGED_IN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({
          user: null,
          accessToken: null,
          ability: null,
          isAuthenticated: false,
          isLoading: false,
        });
      });

    // Only run once on mount.
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  // Register auth helpers synchronously in the render body.
  // This ensures that any child component mounting or triggering side effects (such as LabelsProvider)
  // during the same render cycle will immediately have access to the latest token and helper references,
  // avoiding timing issues and stale closures.
  initAuthHelpers({
    getAccessToken: () => stateRef.current.accessToken,
    setTokens: (access) => {
      setState((s) => ({ ...s, accessToken: access }));
    },
    doRefresh: () => refreshRef.current(),
    doLogout: () => logoutRef.current(),
  });

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
