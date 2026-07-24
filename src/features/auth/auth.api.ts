import { api, setToken } from '@/lib/api/client';
import type { AuthUser, LoginCredentials, LoginResponse } from './types';

/** Inicia sesion contra el colegio (subdominio) y guarda el token. */
export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const { token, user } = await api.post<LoginResponse>('/login', credentials);
  setToken(token);
  return user;
}

/** Recupera el usuario autenticado a partir del token guardado. */
export async function fetchCurrentUser(): Promise<AuthUser> {
  const { user } = await api.get<{ user: AuthUser }>('/me');
  return user;
}

/** Cierra sesion en el backend y limpia el token local. */
export async function logout(): Promise<void> {
  try {
    await api.post('/logout');
  } finally {
    setToken(null);
  }
}
