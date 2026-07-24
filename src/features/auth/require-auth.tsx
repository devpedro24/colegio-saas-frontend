import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

interface RequireAuthProps {
  children: ReactNode;
  /** Permiso requerido opcional; si el usuario no lo tiene, se redirige al dashboard. */
  permission?: string;
  /** Si es true, exige que el usuario sea de plataforma (superadministrador). */
  platform?: boolean;
}

/** Protege rutas: exige sesion iniciada (y opcionalmente un permiso o ser plataforma). */
export function RequireAuth({ children, permission, platform }: RequireAuthProps) {
  const { user, isAuthenticated, isLoading, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (platform && !user?.is_platform) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
