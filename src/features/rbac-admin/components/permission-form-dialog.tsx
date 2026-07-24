import { ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIntl } from 'react-intl';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePermission, useUpdatePermission } from '../rbac-admin.api';
import type { PermissionInput, RbacAdminPermission, RbacFeature } from '../rbac-admin.types';

const NONE = '__none__';

const schema = z.object({
  key: z.string().min(1, 'La clave es obligatoria').regex(/^[a-z0-9._-]+$/, 'Solo minusculas, numeros, punto, guion y guion bajo'),
  module: z.string().min(1, 'El modulo es obligatorio'),
  action: z.string().min(1, 'La descripcion es obligatoria'),
  feature_key: z.string(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function defaults(permission?: RbacAdminPermission): FormValues {
  return {
    key: permission?.key ?? '',
    module: permission?.module ?? '',
    action: permission?.action ?? '',
    feature_key: permission?.feature_key ?? NONE,
    description: permission?.description ?? '',
  };
}

interface Props {
  features: RbacFeature[];
  permission?: RbacAdminPermission;
  trigger: ReactNode;
}

/** Crear (sin `permission`) o editar un permiso del catalogo. */
export function PermissionFormDialog({ features, permission, trigger }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(permission);
  const createPermission = useCreatePermission();
  const updatePermission = useUpdatePermission();
  const pending = createPermission.isPending || updatePermission.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(permission),
  });

  async function onSubmit(values: FormValues) {
    const input: PermissionInput = {
      module: values.module,
      action: values.action,
      feature_key: values.feature_key === NONE ? null : values.feature_key,
      description: values.description?.trim() ? values.description.trim() : null,
    };

    try {
      if (permission) {
        await updatePermission.mutateAsync({ id: permission.id, input });
      } else {
        await createPermission.mutateAsync({ ...input, key: values.key });
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        form.setError('key', { message: error.fieldError('key') ?? error.message });
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults(permission));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('rbacAdmin.perm.edit') : t('rbacAdmin.perm.new')}</DialogTitle>
          <DialogDescription>{t('rbacAdmin.perm.desc')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rbacAdmin.perm.key')}</FormLabel>
                    <FormControl>
                      <Input placeholder="notas.registrar" {...field} disabled={isEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="module"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rbacAdmin.perm.module')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Notas y Consolidados" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rbacAdmin.perm.action')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Registrar notas en su materia" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="feature_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rbacAdmin.perm.feature')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('rbacAdmin.perm.featureNone')}</SelectItem>
                        {features.map((feature) => (
                          <SelectItem key={feature.key} value={feature.key}>
                            {t(feature.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t('rbacAdmin.perm.featureHelp')}</p>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rbacAdmin.perm.description')}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.close')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('rbacAdmin.saving') : isEdit ? t('rbacAdmin.save') : t('rbacAdmin.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
