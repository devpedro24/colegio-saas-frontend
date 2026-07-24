import { ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIntl } from 'react-intl';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useCreateRole, useUpdateRole } from '../rbac-admin.api';
import type { RbacAdminRole, RoleInput } from '../rbac-admin.types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const schema = z.object({
  key: z.string().min(1, 'La clave es obligatoria').regex(/^[a-z0-9_]+$/, 'Solo minusculas, numeros y guion bajo'),
  label: z.string().min(1, 'El nombre es obligatorio'),
});

type FormValues = z.infer<typeof schema>;

function defaults(role?: RbacAdminRole): FormValues {
  return { key: role?.key ?? '', label: role?.label ?? '' };
}

interface Props {
  role?: RbacAdminRole;
  trigger: ReactNode;
}

/** Crear (sin `role`) o editar un rol del catalogo. */
export function RoleFormDialog({ role, trigger }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(role);
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const pending = createRole.isPending || updateRole.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(role),
  });

  async function onSubmit(values: FormValues) {
    const input: RoleInput = { label: values.label };
    try {
      if (role) {
        await updateRole.mutateAsync({ id: role.id, input });
      } else {
        await createRole.mutateAsync({ ...input, key: values.key });
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
        if (next) form.reset(defaults(role));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('rbacAdmin.role.edit') : t('rbacAdmin.role.new')}</DialogTitle>
          <DialogDescription>{t('rbacAdmin.role.desc')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rbacAdmin.role.label')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Coordinador Academico"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          if (!isEdit && !form.formState.dirtyFields.key) {
                            form.setValue('key', slugify(event.target.value), { shouldDirty: false });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rbacAdmin.role.key')}</FormLabel>
                    <FormControl>
                      <Input placeholder="coord_academico" {...field} disabled={isEdit} />
                    </FormControl>
                    <FormMessage />
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
