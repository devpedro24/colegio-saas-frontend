import { ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIntl } from 'react-intl';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { useCreatePlan, useUpdatePlan } from '../planes.api';
import type { Plan, PlanCatalog, PlanInput } from '../planes.types';

const schema = z.object({
  key: z.string().min(1, 'La clave es obligatoria').regex(/^[a-z0-9-]+$/, 'Solo minusculas, numeros y guiones'),
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  is_active: z.boolean(),
  price_monthly: z.string().optional(),
  price_annual: z.string().optional(),
  max_estudiantes: z.string().optional(),
  storage_gb: z.string().optional(),
  max_sedes: z.string().optional(),
  max_pasarelas: z.string().optional(),
  features: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

/** Genera una clave (slug) a partir del nombre. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const numToStr = (value: number | null): string => (value === null ? '' : String(value));
const strToNum = (value?: string): number | null => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : Number(trimmed);
};

function defaults(plan?: Plan): FormValues {
  return {
    key: plan?.key ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    is_active: plan?.is_active ?? true,
    price_monthly: plan?.price_monthly ?? '',
    price_annual: plan?.price_annual ?? '',
    max_estudiantes: numToStr(plan?.max_estudiantes ?? null),
    storage_gb: numToStr(plan?.storage_gb ?? null),
    max_sedes: numToStr(plan?.max_sedes ?? null),
    max_pasarelas: numToStr(plan?.max_pasarelas ?? null),
    features: plan?.features ?? [],
  };
}

interface PlanFormDialogProps {
  catalog: PlanCatalog;
  plan?: Plan;
  trigger: ReactNode;
}

/** Dialogo para crear (sin `plan`) o editar (con `plan`) un plan. */
export function PlanFormDialog({ catalog, plan, trigger }: PlanFormDialogProps) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(plan);

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const pending = createPlan.isPending || updatePlan.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(plan),
  });

  const selected = form.watch('features');

  function toggleFeature(key: string, on: boolean) {
    const next = on ? [...selected, key] : selected.filter((item) => item !== key);
    form.setValue('features', next, { shouldDirty: true });
  }

  async function onSubmit(values: FormValues) {
    const input: PlanInput = {
      key: values.key,
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : null,
      is_active: values.is_active,
      price_monthly: strToNum(values.price_monthly),
      price_annual: strToNum(values.price_annual),
      max_estudiantes: strToNum(values.max_estudiantes),
      storage_gb: strToNum(values.storage_gb),
      max_sedes: strToNum(values.max_sedes),
      max_pasarelas: strToNum(values.max_pasarelas),
      features: values.features,
    };

    try {
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, input });
      } else {
        await createPlan.mutateAsync(input);
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
        if (next) form.reset(defaults(plan));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('planes.edit.title') : t('planes.new.title')}</DialogTitle>
          <DialogDescription>{t('planes.form.desc')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="max-h-[65vh] space-y-6 overflow-y-auto">
              {/* Identidad */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('planes.field.name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Esencial"
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
                      <FormLabel>{t('planes.field.key')}</FormLabel>
                      <FormControl>
                        <Input placeholder="esencial" {...field} disabled={isEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('planes.field.description')}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder={t('planes.field.descriptionPh')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estado + precios */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="price_monthly"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('planes.field.priceMonthly')}</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" placeholder="—" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price_annual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('planes.field.priceAnnual')}</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" placeholder="—" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('planes.field.active')}</FormLabel>
                      <FormControl>
                        <div className="flex h-9 items-center">
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Limites */}
              <div>
                <h4 className="mb-1 text-sm font-semibold text-foreground">{t('planes.limits.title')}</h4>
                <p className="mb-3 text-xs text-muted-foreground">{t('planes.limits.help')}</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {catalog.limits.map((limit) => (
                    <FormField
                      key={limit.key}
                      control={form.control}
                      name={limit.key}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">
                            {t(limit.label)}
                            {limit.unit ? ` (${t(limit.unit)})` : ''}
                          </FormLabel>
                          <FormControl>
                            <Input type="number" min="1" placeholder={t('planes.limit.unlimited')} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Features por categoria */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-foreground">{t('planes.features.title')}</h4>
                <div className="space-y-5">
                  {catalog.categories.map((category) => {
                    const feats = catalog.features.filter((feature) => feature.category === category.key);
                    if (feats.length === 0) return null;
                    return (
                      <div key={category.key}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t(category.label)}
                        </p>
                        <div className="space-y-2.5">
                          {feats.map((feature) => (
                            <label
                              key={feature.key}
                              className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-border p-3 hover:bg-muted/40"
                            >
                              <span className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">{t(feature.label)}</span>
                                <span className="text-xs text-muted-foreground">{t(feature.description)}</span>
                              </span>
                              <Switch
                                checked={selected.includes(feature.key)}
                                onCheckedChange={(value) => toggleFeature(feature.key, value)}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.close')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('planes.saving') : isEdit ? t('planes.save') : t('planes.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
