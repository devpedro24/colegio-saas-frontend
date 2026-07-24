import { Fragment } from 'react';
import { useIntl } from 'react-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionCell } from './permission-cell';
import type { RbacMatrix } from '../types';

interface PermissionMatrixProps {
  matrix: RbacMatrix;
  onToggle: (role: string, permission: string, granted: boolean) => void;
}

/**
 * Tabla de la matriz de permisos: filas = permisos (agrupados por modulo),
 * columnas = roles. La primera columna (permiso) queda fija al hacer scroll.
 */
export function PermissionMatrix({ matrix, onToggle }: PermissionMatrixProps) {
  const intl = useIntl();
  const { roles, modules } = matrix;
  const totalColumns = roles.length + 1;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="min-w-max">
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="sticky left-0 z-10 min-w-[280px] bg-muted/40 text-foreground">
              {intl.formatMessage({ id: 'rbac.permission' })}
            </TableHead>
            {roles.map((role) => (
              <TableHead
                key={role.key}
                className="min-w-[120px] text-center align-bottom text-xs font-medium text-foreground"
              >
                {role.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {modules.map((module) => (
            <Fragment key={module.module}>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={totalColumns}
                  className="bg-muted/60 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {module.module}
                </TableCell>
              </TableRow>

              {module.permissions.map((permission) => (
                <TableRow key={permission.key}>
                  <TableCell className="sticky left-0 z-10 min-w-[280px] bg-background text-sm text-foreground">
                    {permission.action}
                  </TableCell>
                  {roles.map((role) => (
                    <TableCell key={role.key} className="text-center">
                      <PermissionCell
                        cell={permission.cells[role.key]}
                        onToggle={(granted) => onToggle(role.key, permission.key, granted)}
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
