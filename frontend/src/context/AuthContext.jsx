import { createContext, useContext, useMemo, useState } from 'react';
import * as authService from '../services/authService';
import { clearStoredSession, getStoredUser, hasAccessToken, saveSession } from '../utils/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasAccessToken());

  async function login(credentials) {
    const result = await authService.login(credentials);
    saveSession({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
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

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAuthenticated,
      login,
      logout,
      refreshProfile,
    }),
    [isAuthenticated, user],
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
