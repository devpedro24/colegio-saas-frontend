import { ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Pencil, Trash2, Ban, CheckCircle2, CreditCard, KeyRound } from 'lucide-react';
import { getToken } from '@/lib/api/client';
import { createEcho } from '@/lib/echo';
import { useAuth } from '@/features/auth/auth-context';
import { useNotify, NotifyKind } from '@/features/notifications/notifications-context';

// resource emitido por PlatformDataChanged -> queryKey de TanStack a invalidar.
const PLATFORM_KEYS: Record<string, readonly unknown[]> = {
  colegios: ['platform', 'colegios'],
  plans: ['platform', 'planes'],
  rbac: ['platform', 'rbac'],
};

// accion -> color del toast: crear=verde, actualizar=amarillo, borrar/inhabilitar=rojo.
const ACTION_KIND: Record<string, NotifyKind> = {
  created: 'success',
  updated: 'warning',
  deleted: 'error',
  disabled: 'error',
  enabled: 'success',
};

// accion -> icono acorde.
const ACTION_ICON: Record<string, ReactNode> = {
  created: <PlusCircle className="size-6" />,
  updated: <Pencil className="size-6" />,
  deleted: <Trash2 className="size-6" />,
  disabled: <Ban className="size-6" />,
  enabled: <CheckCircle2 className="size-6" />,
};

/**
 * Conecta la app al servidor de WebSockets (Reverb) segun el usuario:
 *  - Superadmin -> canal `platform`: refresca en vivo colegios / planes / RBAC y
 *    notifica cada cambio (crear/editar/borrar) con color e icono.
 *  - Rector      -> canal `tenant.<id>`: si lo inhabilitan lo expulsa; si cambia
 *    su plan/RBAC recarga la matriz. Todo con notificacion.
 *
 * Aislamiento: cada colegio solo se suscribe a SU canal (autorizado en backend).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, forceSignOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();

  const isPlatform = user?.is_platform ?? false;
  const tenantId = user?.tenant_id ?? null;

  useEffect(() => {
    const token = getToken();
    if (!isAuthenticated || !token) return;

    const echo = createEcho(token);

    if (isPlatform) {
      echo.private('platform').listen('.changed', (event: { resource: string; action?: string }) => {
        const key = PLATFORM_KEYS[event.resource];
        if (key) queryClient.invalidateQueries({ queryKey: key });
        // Fallback a 'updated' si el evento no trae accion (worker con codigo viejo).
        const action = event.action ?? 'updated';
        notify(`notif.${event.resource}.${action}`, {
          kind: ACTION_KIND[action] ?? 'info',
          icon: ACTION_ICON[action],
        });
      });
    } else if (tenantId) {
      echo.private(`tenant.${tenantId}`).listen('.changed', (event: { reason: string }) => {
        if (event.reason === 'disabled') {
          notify('notif.tenant.disabled', { kind: 'error', icon: <Ban className="size-6" /> });
          forceSignOut();
          navigate('/login', { replace: true });
        } else if (event.reason === 'plan') {
          notify('notif.tenant.plan', { kind: 'info', icon: <CreditCard className="size-6" /> });
          queryClient.invalidateQueries({ queryKey: ['rbac', 'matrix'] });
        } else if (event.reason === 'rbac') {
          notify('notif.tenant.rbac', { kind: 'info', icon: <KeyRound className="size-6" /> });
          queryClient.invalidateQueries({ queryKey: ['rbac', 'matrix'] });
        }
      });
    }

    return () => {
      echo.disconnect();
    };
  }, [isAuthenticated, isPlatform, tenantId, queryClient, navigate, forceSignOut, notify]);

  return <>{children}</>;
}
