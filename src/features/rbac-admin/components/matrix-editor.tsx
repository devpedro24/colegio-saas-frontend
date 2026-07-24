import { Fragment, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSetMatrixCell } from '../rbac-admin.api';
import type { CellType, RbacCatalog } from '../rbac-admin.types';

const LEVEL_KEY: Record<string, string> = {
  crud: 'rbacAdmin.level.crud',
  editar: 'rbacAdmin.level.editar',
  ver: 'rbacAdmin.level.ver',
  reportar: 'rbacAdmin.level.reportar',
  aprobar: 'rbacAdmin.level.aprobar',
  c: 'rbacAdmin.level.c',
  auto: 'rbacAdmin.level.auto',
};

interface Cell {
  type: CellType;
  level: string | null;
  default_granted: boolean;
}

/** Editor de la matriz global (rol x permiso). El superadmin fija cada celda. */
export function MatrixEditor({ catalog }: { catalog: RbacCatalog }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  // Indexa la matriz por "role|permission".
  const cellMap = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const c of catalog.matrix) {
      map.set(`${c.role_key}|${c.permission_key}`, {
        type: c.type,
        level: c.level,
        default_granted: c.default_granted,
      });
    }
    return map;
  }, [catalog.matrix]);

  // Agrupa permisos por modulo (respetando el orden recibido).
  const modules = useMemo(() => {
    const groups: { module: string; permissions: RbacCatalog['permissions'] }[] = [];
    for (const perm of catalog.permissions) {
      let group = groups.find((g) => g.module === perm.module);
      if (!group) {
        group = { module: perm.module, permissions: [] };
        groups.push(group);
      }
      group.permissions.push(perm);
    }
    return groups;
  }, [catalog.permissions]);

  const totalColumns = catalog.roles.length + 1;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="sticky left-0 z-10 min-w-[280px] bg-muted/40 text-foreground">
              {t('rbac.permission')}
            </TableHead>
            {catalog.roles.map((role) => (
              <TableHead key={role.key} className="min-w-[150px] px-2 text-center align-bottom text-xs font-medium text-foreground">
                {role.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map((group) => (
            <Fragment key={group.module}>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={totalColumns} className="bg-muted/60 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.module}
                </TableCell>
              </TableRow>
              {group.permissions.map((perm) => (
                <TableRow key={perm.key}>
                  <TableCell className="sticky left-0 z-10 min-w-[280px] bg-background text-sm text-foreground">
                    <div>{perm.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {perm.key}
                      {perm.feature_key ? ` · ${perm.feature_key}` : ''}
                    </div>
                  </TableCell>
                  {catalog.roles.map((role) => (
                    <TableCell key={role.key} className="text-center">
                      <CellEditor
                        cell={cellMap.get(`${role.key}|${perm.key}`) ?? { type: 'denied', level: null, default_granted: false }}
                        levels={catalog.levels}
                        roleKey={role.key}
                        permissionKey={perm.key}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CellEditor({
  cell,
  levels,
  roleKey,
  permissionKey,
}: {
  cell: Cell;
  levels: string[];
  roleKey: string;
  permissionKey: string;
}) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CellType>(cell.type);
  const [level, setLevel] = useState<string>(cell.level ?? 'ver');
  const [defaultGranted, setDefaultGranted] = useState<boolean>(cell.default_granted);
  const setCell = useSetMatrixCell();

  // Sincroniza el estado local al abrir (por si cambio el catalogo).
  function onOpenChange(next: boolean) {
    if (next) {
      setType(cell.type);
      setLevel(cell.level ?? 'ver');
      setDefaultGranted(cell.default_granted);
    }
    setOpen(next);
  }

  function apply() {
    setCell.mutate(
      { role_key: roleKey, permission_key: permissionKey, type, level, default_granted: defaultGranted },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 py-1.5 text-xs hover:border-input hover:bg-muted/50"
        >
          <CellBadge cell={cell} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-60 space-y-3">
        <div className="text-xs font-medium text-muted-foreground">{permissionKey}</div>

        <div className="grid grid-cols-3 gap-1">
          {(['structural', 'configurable', 'denied'] as CellType[]).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={type === option ? 'primary' : 'outline'}
              className="px-1 text-xs"
              onClick={() => setType(option)}
            >
              {t(`rbacAdmin.type.${option}`)}
            </Button>
          ))}
        </div>

        {type === 'structural' && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('rbacAdmin.cell.level')}</span>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {levels.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>
                    {t(LEVEL_KEY[lvl] ?? lvl)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {type === 'configurable' && (
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{t('rbacAdmin.cell.defaultOn')}</span>
            <Switch checked={defaultGranted} onCheckedChange={setDefaultGranted} />
          </label>
        )}

        <Button type="button" size="sm" className="w-full" onClick={apply} disabled={setCell.isPending}>
          {setCell.isPending ? t('rbacAdmin.saving') : t('rbacAdmin.apply')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function CellBadge({ cell }: { cell: Cell }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  if (cell.type === 'denied') {
    return <span className="text-muted-foreground">—</span>;
  }
  if (cell.type === 'structural') {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-foreground">
        <Lock className="size-3.5 shrink-0" />
        {t(LEVEL_KEY[cell.level ?? ''] ?? 'rbacAdmin.type.structural')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-primary">
      <span className={cn('size-2 shrink-0 rounded-full', cell.default_granted ? 'bg-primary' : 'bg-muted-foreground/40')} />
      {t('rbacAdmin.type.configurable')}
    </span>
  );
}
