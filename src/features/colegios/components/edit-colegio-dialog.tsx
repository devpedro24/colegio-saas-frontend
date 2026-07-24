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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateColegio } from '../colegios.api';
import { usePlanes } from '@/features/planes/planes.api';
import type { Colegio, UpdateColegioInput } from '../types';

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  legal_name: z.string().optional(),
  nit: z.string().optional(),
  plan: z.string().min(1, 'Selecciona un plan'),
});

type FormValues = z.infer<typeof schema>;

function defaults(colegio: Colegio): FormValues {
  return {
    name: colegio.name,
    legal_name: colegio.legal_name ?? '',
    nit: colegio.nit ?? '',
    plan: colegio.plan,
  };
}

interface Props {
  colegio: Colegio;
  trigger: ReactNode;
}

/** Edita los datos de un colegio (nombre, razon social, NIT, plan). */
export function EditColegioDialog({ colegio, trigger }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const updateColegio = useUpdateColegio();
  const { data: planesData } = usePlanes();
  const planes = (planesData?.data ?? []).filter((plan) => plan.is_active);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(colegio),
  });

  async function onSubmit(values: FormValues) {
    const input: UpdateColegioInput = {
      name: values.name,
      legal_name: values.legal_name?.trim() ? values.legal_name.trim() : null,
      nit: values.nit?.trim() ? values.nit.trim() : null,
      plan: values.plan,
    };
    try {
      await updateColegio.mutateAsync({ id: colegio.id, input });
      setOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        form.setError('name', { message: error.fieldError('name') ?? error.message });
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults(colegio));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('colegios.edit.title')}</DialogTitle>
          <DialogDescription>
            {colegio.subdomain} · {t('colegios.edit.desc')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('colegios.field.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="legal_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('colegios.field.legalName')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Fundacion Educativa..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('colegios.field.nit')}</FormLabel>
                    <FormControl>
                      <Input placeholder="900.123.456-7" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('colegios.col.plan')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('colegios.field.selectPlan')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {planes.map((plan) => (
                          <SelectItem key={plan.key} value={plan.key}>
                            {plan.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.close')}
              </Button>
              <Button type="submit" disabled={updateColegio.isPending}>
                {updateColegio.isPending ? t('rbacAdmin.saving') : t('rbacAdmin.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
