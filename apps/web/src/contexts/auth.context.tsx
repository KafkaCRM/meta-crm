import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Ability } from '@casl/ability';
import { buildTenantAbility } from '@meta-crm/permissions';
import type { TenantRoleEntry, TenantAbility } from '@meta-crm/permissions';
import { login as apiLogin, refreshToken as apiRefresh, logout as apiLogout, type LoginResult } from '@/api/auth';
import { initAuthHelpers, apiCall } from '@/lib/api';
import { initSocket, disconnectSocket, onReconnecting, onDisconnect } from '@/lib/socket';
import { queryClient } from '@/lib/query-client';

const LOGGED_IN_KEY = 'meta_crm_logged_in';
const USER_KEY = 'meta_crm_user';
const ACCESS_TOKEN_KEY = 'meta_crm_access_token';
const REFRESH_TOKEN_KEY = 'meta_crm_refresh_token';

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
  isImpersonating: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, tenantSlug?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  impersonate: (token: string, user: AuthUser) => void;
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
  const storedUser = readStoredUser();
  const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  const initialAbility = storedUser
    ? buildTenantAbility([{ role: storedUser.role as TenantRoleEntry['role'] }], storedUser.assignment_ids)
    : null;

  const [state, setState] = useState<AuthState>({
    user: storedUser,
    accessToken: storedAccessToken,
    ability: initialAbility,
    isAuthenticated: Boolean(storedUser && (storedAccessToken || storedRefreshToken)),
    isLoading: isPreviouslyLoggedIn && !storedAccessToken && Boolean(storedRefreshToken),
    isImpersonating: localStorage.getItem('meta_crm_is_impersonating') === 'true',
  });

  const login = useCallback(async (email: string, password: string, tenantSlug?: string): Promise<LoginResult> => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await apiLogin({ email, password, tenant_slug: tenantSlug });

      if ('multiple_workspaces' in result) {
        setState((s) => ({ ...s, isLoading: false }));
        return result;
      }

      const roles: TenantRoleEntry[] = [{ role: result.user.role as TenantRoleEntry['role'] }];
      const ability = buildTenantAbility(roles, result.user.assignment_ids);

      // Persist session tokens and user info so they survive page refreshes.
      localStorage.setItem(LOGGED_IN_KEY, 'true');
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, result.refresh_token);

      // Clear React Query cache so the new user session starts fresh
      queryClient.clear();

      setState({
        user: result.user,
        accessToken: result.access_token,
        ability,
        isAuthenticated: true,
        isLoading: false,
        isImpersonating: false,
      });

      initSocket(result.access_token);
      return result;
    } catch (err: any) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, []);

  const impersonate = useCallback((token: string, user: AuthUser) => {
    const roles: TenantRoleEntry[] = [{ role: user.role as TenantRoleEntry['role'] }];
    const ability = buildTenantAbility(roles, user.assignment_ids);

    localStorage.setItem(LOGGED_IN_KEY, 'true');
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('meta_crm_is_impersonating', 'true');
    sessionStorage.setItem('meta_crm_impersonation_token', token);

    queryClient.clear();

    setState({
      user,
      accessToken: token,
      ability,
      isAuthenticated: true,
      isLoading: false,
      isImpersonating: true,
    });

    initSocket(token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout(state.accessToken || localStorage.getItem(ACCESS_TOKEN_KEY) || undefined);
    } catch {}
    localStorage.removeItem(LOGGED_IN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('meta_crm_is_impersonating');
    sessionStorage.removeItem('meta_crm_impersonation_token');
    disconnectSocket();
    setState({
      user: null,
      accessToken: null,
      ability: null,
      isAuthenticated: false,
      isLoading: false,
      isImpersonating: false,
    });
    queryClient.clear();
  }, [state.accessToken]);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (localStorage.getItem(LOGGED_IN_KEY) !== 'true') return null;
    if (localStorage.getItem('meta_crm_is_impersonating') === 'true') {
      return stateRef.current.accessToken;
    }
    const token = localStorage.getItem(REFRESH_TOKEN_KEY) || undefined;
    if (!token) {
      await logout();
      return null;
    }
    try {
      const result = await apiRefresh(token);
      localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
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
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (localStorage.getItem('meta_crm_is_impersonating') === 'true') {
      const impersonationToken = sessionStorage.getItem('meta_crm_impersonation_token');
      if (storedUser && impersonationToken) {
        const roles: TenantRoleEntry[] = [{ role: storedUser.role as TenantRoleEntry['role'] }];
        const ability = buildTenantAbility(roles, storedUser.assignment_ids);

        setState({
          user: storedUser,
          accessToken: impersonationToken,
          ability,
          isAuthenticated: true,
          isLoading: false,
          isImpersonating: true,
        });

        initSocket(impersonationToken);
        return;
      } else {
        localStorage.removeItem(LOGGED_IN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem('meta_crm_is_impersonating');
        sessionStorage.removeItem('meta_crm_impersonation_token');
        setState({
          user: null,
          accessToken: null,
          ability: null,
          isAuthenticated: false,
          isLoading: false,
          isImpersonating: false,
        });
        return;
      }
    }

    if (!token) {
      // If we don't have a refresh token, check if we have an active access token
      const currentAccess = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!currentAccess || !storedUser) {
        logout();
      }
      return;
    }

    apiRefresh(token)
      .then((result) => {
        if (!storedUser) {
          throw new Error('no_user');
        }

        const roles: TenantRoleEntry[] = [{ role: storedUser.role as TenantRoleEntry['role'] }];
        const ability = buildTenantAbility(roles, storedUser.assignment_ids);

        localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);

        setState({
          user: storedUser,
          accessToken: result.access_token,
          ability,
          isAuthenticated: true,
          isLoading: false,
          isImpersonating: false,
        });

        initSocket(result.access_token);
      })
      .catch(() => {
        // Only force logout if we also don't have a valid access token
        const currentAccess = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (!currentAccess) {
          localStorage.removeItem(LOGGED_IN_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem('meta_crm_is_impersonating');
          sessionStorage.removeItem('meta_crm_impersonation_token');
          setState({
            user: null,
            accessToken: null,
            ability: null,
            isAuthenticated: false,
            isLoading: false,
            isImpersonating: false,
          });
        }
      });

    // Only run once on mount.
  }, [logout]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  // Register auth helpers synchronously in the render body.
  initAuthHelpers({
    getAccessToken: () => stateRef.current.accessToken || localStorage.getItem(ACCESS_TOKEN_KEY),
    setTokens: (access, refreshTok) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, access);
      if (refreshTok) localStorage.setItem(REFRESH_TOKEN_KEY, refreshTok);
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
    <AuthContext.Provider value={{ ...state, login, logout, impersonate }}>
      {children}
    </AuthContext.Provider>
  );
}
