import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { CheckCircle2, TriangleAlert, XCircle, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppNotification, NotificationsContext, NotifyKind, NotifyOptions } from './notifications-context';

const MAX = 40;

// Estilo por tipo: verde=creado, amarillo=actualizado, rojo=error, negro=info.
const KIND_STYLE: Record<NotifyKind, { box: string; Icon: LucideIcon }> = {
  success: { box: 'bg-green-600 text-white border-green-700', Icon: CheckCircle2 },
  warning: { box: 'bg-amber-400 text-amber-950 border-amber-500', Icon: TriangleAlert },
  error: { box: 'bg-red-600 text-white border-red-700', Icon: XCircle },
  info: { box: 'bg-zinc-900 text-white border-zinc-800', Icon: Info },
};

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/** Muestra un toast grande y con color/icono acorde al tipo. */
function showToast(kind: NotifyKind, message: string, icon?: ReactNode): void {
  const { box, Icon } = KIND_STYLE[kind];
  toast.custom(
    () => (
      <div
        role="alert"
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-[15px] font-semibold shadow-lg',
          box,
        )}
      >
        <span className="shrink-0">{icon ?? <Icon className="size-6" />}</span>
        <span className="leading-snug">{message}</span>
      </div>
    ),
    { duration: 4500 },
  );
}

/**
 * Centro de notificaciones: cada `notify(clave)` muestra un toast (arriba a la
 * derecha, grande, con color e icono segun el tipo) y guarda la notificacion en
 * una lista (la campana del header la muestra). El mensaje se traduce al emitir.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const intl = useIntl();
  const intlRef = useRef(intl);
  intlRef.current = intl;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const notify = useCallback((messageKey: string, options?: NotifyOptions) => {
    const kind = options?.kind ?? 'success';
    const message = intlRef.current.formatMessage({ id: messageKey }, options?.values);
    showToast(kind, message, options?.icon);
    setNotifications((prev) =>
      [{ id: makeId(), message, kind, at: Date.now(), read: false }, ...prev].slice(0, MAX),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.reduce((count, n) => count + (n.read ? 0 : 1), 0);

  const value = useMemo(
    () => ({ notifications, unreadCount, notify, markAllRead, clear }),
    [notifications, unreadCount, notify, markAllRead, clear],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
