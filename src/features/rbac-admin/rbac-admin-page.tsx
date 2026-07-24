import { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useRbacCatalog, useDeletePermission, useDeleteRole } from './rbac-admin.api';
import { PermissionFormDialog } from './components/permission-form-dialog';
import { RoleFormDialog } from './components/role-form-dialog';
import { MatrixEditor } from './components/matrix-editor';
import type { RbacCatalog, RbacFeature } from './rbac-admin.types';

/** Panel del superadmin: catalogo RBAC (permisos, roles, matriz global). */
export function RbacAdminPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { data, isLoading, isError } = useRbacCatalog();

  return (
    <div className="container-fluid py-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">{t('rbacAdmin.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('rbacAdmin.description')}</p>
      </div>

      {isLoading && <Skeleton className="h-96 w-full rounded-lg" />}

      {isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('rbacAdmin.loadError')}
        </p>
      )}

      {data && (
        <Tabs defaultValue="permissions">
          <TabsList variant="line">
            <TabsTrigger value="permissions">{t('rbacAdmin.tab.permissions')}</TabsTrigger>
            <TabsTrigger value="roles">{t('rbacAdmin.tab.roles')}</TabsTrigger>
            <TabsTrigger value="matrix">{t('rbacAdmin.tab.matrix')}</TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="mt-4">
            <PermissionsTab catalog={data} />
          </TabsContent>
          <TabsContent value="roles" className="mt-4">
            <RolesTab catalog={data} />
          </TabsContent>
          <TabsContent value="matrix" className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">{t('rbacAdmin.matrix.help')}</p>
            <MatrixEditor catalog={data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PermissionsTab({ catalog }: { catalog: RbacCatalog }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const del = useDeletePermission();

  const featureLabel = (key: string | null): string | null => {
    if (!key) return null;
    const feature = catalog.features.find((f: RbacFeature) => f.key === key);
    return feature ? t(feature.label) : key;
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <PermissionFormDialog
          features={catalog.features}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              {t('rbacAdmin.perm.create')}
            </Button>
          }
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('rbacAdmin.perm.module')}</TableHead>
              <TableHead>{t('rbacAdmin.perm.action')}</TableHead>
              <TableHead>{t('rbacAdmin.perm.key')}</TableHead>
              <TableHead>{t('rbacAdmin.perm.feature')}</TableHead>
              <TableHead className="w-24 text-right">{t('rbacAdmin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalog.permissions.map((perm) => (
              <TableRow key={perm.id}>
                <TableCell className="text-muted-foreground">{perm.module}</TableCell>
                <TableCell className="font-medium text-foreground">{perm.action}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{perm.key}</TableCell>
                <TableCell>
                  {featureLabel(perm.feature_key) ? (
                    <Badge variant="secondary" appearance="light">{featureLabel(perm.feature_key)}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('rbacAdmin.perm.core')}</span>
                  )}
                </TableCell>
                <TableCell>
                  <RowActions
                    isSystem={perm.is_system}
                    onDelete={() => del.mutate(perm.id)}
                    editDialog={
                      <PermissionFormDialog
                        features={catalog.features}
                        permission={perm}
                        trigger={
                          <Button type="button" variant="ghost" size="sm" className="size-8 p-0" aria-label={t('rbacAdmin.edit')} title={t('rbacAdmin.edit')}>
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RolesTab({ catalog }: { catalog: RbacCatalog }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const del = useDeleteRole();

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <RoleFormDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              {t('rbacAdmin.role.create')}
            </Button>
          }
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('rbacAdmin.role.label')}</TableHead>
              <TableHead>{t('rbacAdmin.role.key')}</TableHead>
              <TableHead className="w-24 text-right">{t('rbacAdmin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {catalog.roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium text-foreground">{role.label}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{role.key}</TableCell>
                <TableCell>
                  <RowActions
                    isSystem={role.is_system}
                    onDelete={() => del.mutate(role.id)}
                    editDialog={
                      <RoleFormDialog
                        role={role}
                        trigger={
                          <Button type="button" variant="ghost" size="sm" className="size-8 p-0" aria-label={t('rbacAdmin.edit')} title={t('rbacAdmin.edit')}>
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Acciones por fila: editar + eliminar (con confirmacion). Los del sistema no se borran. */
function RowActions({ isSystem, onDelete, editDialog }: { isSystem: boolean; onDelete: () => void; editDialog: ReactNode }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  return (
    <div className="flex items-center justify-end gap-1">
      {editDialog}
      {isSystem ? (
        <Badge variant="secondary" appearance="light" className="text-[10px]">{t('rbacAdmin.system')}</Badge>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="size-8 p-0 text-destructive" aria-label={t('rbacAdmin.delete')}>
              <Trash2 className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('rbacAdmin.delete.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('rbacAdmin.delete.desc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.close')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onDelete}>
                {t('rbacAdmin.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
