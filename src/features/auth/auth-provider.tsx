import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { getToken, setToken } from '@/lib/api/client';
import { AuthContext } from './auth-context';
import { fetchCurrentUser, login as loginRequest, logout as logoutRequest } from './auth.api';
import type { AuthUser } from './types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Si hay token guardado, arrancamos en "cargando" mientras validamos /me.
  const [isLoading, setIsLoading] = useState<boolean>(() => getToken() !== null);

  useEffect(() => {
    if (getToken() === null) {
      setIsLoading(false);
      return;
    }

    let active = true;
    fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const currentUser = await loginRequest({ email, password });
    setUser(currentUser);
    return currentUser;
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  // Cierra la sesion sin llamar a la API (p. ej. si el colegio fue inhabilitado y
  // el backend ya responde 403 a todo, incluido /logout).
  const forceSignOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const can = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      signIn,
      signOut,
      forceSignOut,
      can,
    }),
    [user, isLoading, signIn, signOut, forceSignOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
