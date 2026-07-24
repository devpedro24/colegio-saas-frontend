import { createContext, useContext, ReactNode } from 'react';

export type NotifyKind = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  /** Mensaje ya traducido. */
  message: string;
  kind: NotifyKind;
  /** Epoch ms. */
  at: number;
  read: boolean;
}

export interface NotifyOptions {
  kind?: NotifyKind;
  /** Valores para interpolar en el mensaje i18n. */
  values?: Record<string, string | number>;
  /** Icono a mostrar en el toast (acorde a la accion). */
  icon?: ReactNode;
}

export interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  /** Muestra un toast + guarda la notificacion. `messageKey` es una clave i18n. */
  notify: (messageKey: string, options?: NotifyOptions) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>');
  }
  return context;
}

/** Atajo para solo emitir notificaciones. */
export function useNotify(): NotificationsContextValue['notify'] {
  return useNotifications().notify;
}
