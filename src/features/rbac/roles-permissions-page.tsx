import { useIntl } from 'react-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { MatrixLegend } from './components/matrix-legend';
import { PermissionMatrix } from './components/permission-matrix';
import { useRbacMatrix, useTogglePermission } from './rbac.api';

/** Pantalla de configuracion de Roles y Permisos (matriz de 3 capas). */
export function RolesPermissionsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { data, isLoading, isError } = useRbacMatrix();
  const toggle = useTogglePermission();

  return (
    <div className="container-fluid py-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">{t('rbac.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('rbac.description')}
        </p>
      </div>

      <MatrixLegend className="mb-4" />

      {isLoading && <Skeleton className="h-96 w-full rounded-lg" />}

      {isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('rbac.loadError')}
        </p>
      )}

      {data && (
        <PermissionMatrix
          matrix={data}
          onToggle={(role, permission, granted) => toggle.mutate({ role, permission, granted })}
        />
      )}
    </div>
  );
}
