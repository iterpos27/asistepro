import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { clearStoredSession, getCsrfToken, getStoredUser, saveSession } from '../utils/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let mounted = true;
    const storedUser = getStoredUser();

    if (!storedUser && !getCsrfToken()) {
      clearStoredSession();
      setUser(null);
      setIsAuthenticated(false);
      setBootstrapping(false);
      return () => {
        mounted = false;
      };
    }

    authService
      .refreshToken()
      .then((result) => {
        if (!mounted) return;
        saveSession({
          accessToken: result.tokens.accessToken,
          csrfToken: result.session?.csrfToken,
          expiresInMs: result.session?.expiresInMs,
          user: result.user,
        });
        setUser(result.user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!mounted) return;
        clearStoredSession();
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (mounted) setBootstrapping(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function login(credentials) {
    const result = await authService.login(credentials);
    saveSession({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      csrfToken: result.session?.csrfToken,
      expiresInMs: result.session?.expiresInMs,
      user: result.user,
    });
    setUser(result.user);
    setIsAuthenticated(true);
    return result.user;
  }

  async function logout() {
    try {
      await authService.logout();
    } catch {
      // La salida local debe completarse aunque el token ya no exista en backend.
    } finally {
      clearStoredSession();
      setUser(null);
      setIsAuthenticated(false);
    }
  }

  async function refreshProfile() {
    const profile = await authService.getProfile();
    setUser(profile);
    return profile;
  }

  async function registerTenant(payload) {
    const result = await authService.registerTenant(payload);
    saveSession({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      csrfToken: result.session?.csrfToken,
      expiresInMs: result.session?.expiresInMs,
      user: result.user,
    });
    setUser(result.user);
    setIsAuthenticated(true);
    return result;
  }

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAuthenticated,
      bootstrapping,
      login,
      logout,
      refreshProfile,
      registerTenant,
    }),
    [bootstrapping, isAuthenticated, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  }

  return context;
}
