import { useIntl } from 'react-intl';
import { Lock, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Explica visualmente las 3 capas de la matriz de permisos. */
export function MatrixLegend({ className }: { className?: string }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Lock className="size-3.5" />
        {t('rbac.legend.structural')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-4 w-7 rounded-full bg-primary" />
        {t('rbac.legend.configurable')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Minus className="size-3.5" />
        {t('rbac.legend.none')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
        {t('rbac.legend.locked')}
      </span>
    </div>
  );
}
