import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API } from "@/constants/api";
import { ApiError, apiRequest, setAuthErrorHandler } from "@/utils/apiClient";

type User = {
  id: string;
  name: string;
  email: string;
  [key: string]: unknown;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: Partial<User>) => void;
  // Components / contexts that need to flush per-user state on sign-out can
  // register a callback here. Each callback fires synchronously on logout
  // before the user/token are cleared, so they can read auth state if needed.
  registerLogoutHandler: (fn: () => void) => () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "muves_token";
const USER_KEY = "muves_user";

// Time after which we give up waiting for the background auth check on
// startup. The cached session is already restored synchronously, so this
// only affects whether we attempt to refresh against the server.
// Generous because Render's free tier cold-boot takes 30-60s and we don't
// want to log the user out when the server is just waking up.
const CHECK_AUTH_TIMEOUT_MS = 45_000;
const LOGIN_TIMEOUT_MS = 60_000;
const LOGOUT_TIMEOUT_MS = 6_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const logoutHandlersRef = useRef<Set<() => void>>(new Set());
  // Guards against double-logout from concurrent 401 responses
  const loggingOutRef = useRef(false);

  const runLogoutHandlers = useCallback(() => {
    for (const fn of logoutHandlersRef.current) {
      try { fn(); } catch { /* one bad handler shouldn't block others */ }
    }
  }, []);

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;

    const t = token;
    runLogoutHandlers();

    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY).catch(() => {}),
      AsyncStorage.removeItem(USER_KEY).catch(() => {}),
    ]);
    setToken(null);
    setUser(null);

    if (t) {
      // Best-effort server-side invalidation; never block sign-out on it
      apiRequest(API.LOGOUT, {
        method: "POST",
        token: t,
        timeoutMs: LOGOUT_TIMEOUT_MS,
        skipAuthErrorHook: true,
      }).catch(() => {});
    }

    // Reset the latch on next tick so a future login can also sign out cleanly
    setTimeout(() => { loggingOutRef.current = false; }, 0);
  }, [token, runLogoutHandlers]);

  // Install global auth-error hook used by apiClient on any 401/403
  useEffect(() => {
    setAuthErrorHandler((status) => {
      // 403 can mean "account disabled / not verified" — still sign out so
      // the user lands on the login screen with a fresh state.
      if (status === 401 || status === 403) {
        logout();
      }
    });
    return () => setAuthErrorHandler(null);
  }, [logout]);

  // Tracks whether the AuthProvider is still mounted so async callbacks
  // from checkAuth don't call setState after the component is unmounted.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuth() {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (!mountedRef.current) return;

      if (!storedToken) {
        setLoading(false);
        return;
      }

      // Restore session from cache immediately so the app is usable offline.
      // Even if validation later fails, the user sees a populated UI in the
      // meantime instead of a blocking spinner.
      if (storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as User);
        } catch {
          // Corrupt cached user — clear it; server check below will repopulate
          await AsyncStorage.removeItem(USER_KEY).catch(() => {});
        }
      } else {
        setToken(storedToken);
      }

      // Validate token with the server. Use skipAuthErrorHook because we
      // handle 401/403 inline below (firing the global hook here would
      // recursively call logout while we're still booting).
      try {
        const data = await apiRequest<{ user?: User } | User>(API.CHECK_AUTH, {
          token: storedToken,
          timeoutMs: CHECK_AUTH_TIMEOUT_MS,
          skipAuthErrorHook: true,
        });
        if (!mountedRef.current) return;
        const freshUser = (data as { user?: User })?.user ?? (data as User);
        if (freshUser && (freshUser as User).email) {
          setToken(storedToken);
          setUser(freshUser as User);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser)).catch(() => {});
        }
      } catch (err) {
        if (!mountedRef.current) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          // Token is invalid/expired — clear everything
          await Promise.all([
            AsyncStorage.removeItem(TOKEN_KEY).catch(() => {}),
            AsyncStorage.removeItem(USER_KEY).catch(() => {}),
          ]);
          runLogoutHandlers();
          setToken(null);
          setUser(null);
        }
        // Network error / 5xx / timeout — keep cached session so the user
        // isn't logged out offline. They'll hit a fresh check on next launch.
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: User }>(API.LOGIN, {
      method: "POST",
      body: { email, password },
      timeoutMs: LOGIN_TIMEOUT_MS,
      skipAuthErrorHook: true,
    });

    if (!data?.token || !data?.user?.email) {
      throw new Error("Login response was malformed");
    }

    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, data.token).catch(() => {}),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)).catch(() => {}),
    ]);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const updateUser = useCallback((u: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...u };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const registerLogoutHandler = useCallback((fn: () => void) => {
    logoutHandlersRef.current.add(fn);
    return () => { logoutHandlersRef.current.delete(fn); };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, updateUser, registerLogoutHandler }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
