import { createContext, useContext } from 'react';
import type { AuthUser } from './types';

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  /** Cierra la sesion localmente (sin llamar a la API); util si el colegio fue inhabilitado. */
  forceSignOut: () => void;
  /** ¿El usuario tiene un permiso concreto? (referencial; la autoridad es el backend). */
  can: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
