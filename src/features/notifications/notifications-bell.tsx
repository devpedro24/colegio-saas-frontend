import { useIntl } from 'react-intl';
import { Bell, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications, NotifyKind } from './notifications-context';

const DOT: Record<NotifyKind, string> = {
  success: 'bg-green-500',
  info: 'bg-zinc-900 dark:bg-zinc-200',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

/** Campana de notificaciones del header: contador de no leidas + lista. */
export function NotificationsBell() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { notifications, unreadCount, markAllRead, clear } = useNotifications();

  const formatTime = (at: number) =>
    new Date(at).toLocaleTimeString(intl.locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) markAllRead(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white/70 hover:text-white hover:bg-white/10"
          aria-label={t('notif.title')}
        >
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={11} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold text-foreground">{t('notif.title')}</span>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Check className="size-3" />
              {t('notif.clear')}
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">{t('notif.empty')}</div>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[n.kind])} />
                <div className="flex flex-col">
                  <span className="text-sm text-foreground">{n.message}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(n.at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
