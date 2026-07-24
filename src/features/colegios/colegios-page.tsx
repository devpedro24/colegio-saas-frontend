import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Pencil, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useColegios, useUpdateColegioStatus } from './colegios.api';
import { usePlanes } from '@/features/planes/planes.api';
import { CreateColegioDialog } from './components/create-colegio-dialog';
import { EditColegioDialog } from './components/edit-colegio-dialog';
import { RectorPasswordDialog } from './components/rector-password-dialog';
import type { Colegio, ColegioStatus } from './types';

type StatusVariant = 'success' | 'warning' | 'secondary' | 'destructive';

// Cada estado -> clave i18n de la etiqueta + color del badge.
const STATUS_META: Record<string, { label: string; variant: StatusVariant }> = {
  active: { label: 'colegios.status.active', variant: 'success' },
  configuring: { label: 'colegios.status.configuring', variant: 'warning' },
  provisioning: { label: 'colegios.status.provisioning', variant: 'secondary' },
  suspended: { label: 'colegios.status.suspended', variant: 'destructive' },
};

const PLAN_LABELS: Record<string, string> = {
  esencial: 'plan.esencial',
  estandar: 'plan.estandar',
  premium: 'plan.premium',
};

function StatusBadge({ status }: { status: ColegioStatus }) {
  const intl = useIntl();
  const meta = STATUS_META[status] ?? { label: status, variant: 'secondary' as const };
  return (
    <Badge variant={meta.variant} appearance="light">
      {intl.formatMessage({ id: meta.label })}
    </Badge>
  );
}

/** Acciones por colegio: editar + toggle habilitar/inhabilitar (con confirmacion). */
function ColegioActions({ colegio }: { colegio: Colegio }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const updateStatus = useUpdateColegioStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Inhabilitado = suspendido (bloquea el subdominio). El resto se considera habilitado.
  const enabled = colegio.status !== 'suspended';

  function onToggle(next: boolean) {
    if (next) {
      updateStatus.mutate({ id: colegio.id, status: 'active' });
    } else {
      setConfirmOpen(true); // inhabilitar requiere confirmacion
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <EditColegioDialog
        colegio={colegio}
        trigger={
          <Button type="button" variant="ghost" size="sm" className="size-8 p-0" aria-label={t('colegios.edit.title')} title={t('colegios.edit.title')}>
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <RectorPasswordDialog
        colegio={colegio}
        trigger={
          <Button type="button" variant="ghost" size="sm" className="size-8 p-0" aria-label={t('colegios.pwd.title')} title={t('colegios.pwd.title')}>
            <KeyRound className="size-3.5" />
          </Button>
        }
      />
      <Switch
        size="sm"
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={updateStatus.isPending}
        aria-label={t(enabled ? 'colegios.disable' : 'colegios.enable')}
        title={t(enabled ? 'colegios.disable' : 'colegios.enable')}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('colegios.disable.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('colegios.disable.desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.close')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => updateStatus.mutate({ id: colegio.id, status: 'suspended' })}
            >
              {t('colegios.disable')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Panel del superadministrador: listado y alta de colegios. */
export function ColegiosPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { data, isLoading, isError } = useColegios();
  // Nombre real del plan desde la BD; fallback a la etiqueta i18n o a la clave.
  const { data: planesData } = usePlanes();
  const planName = (key: string): string => {
    const fromDb = planesData?.data.find((plan) => plan.key === key)?.name;
    if (fromDb) return fromDb;
    const labelKey = PLAN_LABELS[key];
    return labelKey ? t(labelKey) : key;
  };

  return (
    <div className="container-fluid py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('colegios.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('colegios.description')}
          </p>
        </div>
        <CreateColegioDialog />
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-lg" />}

      {isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('colegios.loadError')}
        </p>
      )}

      {data && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colegios.col.name')}</TableHead>
                <TableHead>{t('colegios.col.subdomain')}</TableHead>
                <TableHead>{t('colegios.col.plan')}</TableHead>
                <TableHead>{t('colegios.col.status')}</TableHead>
                <TableHead className="text-right">{t('colegios.col.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t('colegios.empty')}
                  </TableCell>
                </TableRow>
              )}
              {data.map((colegio) => (
                <TableRow key={colegio.id}>
                  <TableCell className="font-medium text-foreground">{colegio.name}</TableCell>
                  <TableCell className="text-muted-foreground">{colegio.subdomain}</TableCell>
                  <TableCell>{planName(colegio.plan)}</TableCell>
                  <TableCell>
                    <StatusBadge status={colegio.status} />
                  </TableCell>
                  <TableCell>
                    <ColegioActions colegio={colegio} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
