import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
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
import { useCreateColegio } from '../colegios.api';
import { usePlanes } from '@/features/planes/planes.api';
import type { CreateColegioResponse } from '../types';

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  slug: z
    .string()
    .min(1, 'El subdominio es obligatorio')
    .regex(/^[a-z0-9-]+$/, 'Solo minusculas, numeros y guiones'),
  rector_name: z.string().min(1, 'El nombre del rector es obligatorio'),
  rector_email: z.string().min(1, 'El correo es obligatorio').email('Correo invalido'),
  legal_name: z.string().optional(),
  nit: z.string().optional(),
  plan: z.string().min(1, 'Selecciona un plan'),
});

type FormValues = z.infer<typeof schema>;

/** Genera un slug (subdominio) a partir del nombre. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateColegioDialog() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ data: CreateColegioResponse; rectorEmail: string } | null>(null);
  const createColegio = useCreateColegio();
  // Los planes reales se leen de la BD (mismos que administra el superadmin).
  const { data: planesData, isLoading: plansLoading, isError: plansError } = usePlanes();
  const planes = (planesData?.data ?? []).filter((plan) => plan.is_active);
  const firstPlanKey = planes[0]?.key;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', rector_name: '', rector_email: '', legal_name: '', nit: '', plan: '' },
  });

  // Al cargar los planes, preselecciona el primero activo si aun no hay elegido.
  useEffect(() => {
    if (firstPlanKey && !form.getValues('plan')) {
      form.setValue('plan', firstPlanKey);
    }
  }, [firstPlanKey, form]);

  function resetAll() {
    form.reset({ name: '', slug: '', rector_name: '', rector_email: '', legal_name: '', nit: '', plan: firstPlanKey ?? '' });
    setResult(null);
    createColegio.reset();
  }

  async function onSubmit(values: FormValues) {
    try {
      const data = await createColegio.mutateAsync({
        ...values,
        legal_name: values.legal_name?.trim() ? values.legal_name.trim() : null,
        nit: values.nit?.trim() ? values.nit.trim() : null,
      });
      setResult({ data, rectorEmail: values.rector_email });
    } catch (error) {
      if (error instanceof ApiError) {
        // Mapea cada error de validacion a su campo; lo que no calce va al error general.
        const fields = ['name', 'slug', 'rector_name', 'rector_email', 'plan'] as const;
        let mapped = false;
        for (const field of fields) {
          const message = error.fieldError(field);
          if (message) {
            form.setError(field, { message });
            mapped = true;
          }
        }
        if (!mapped) form.setError('root', { message: error.message });
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {t('colegios.create')}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('colegios.created.title')}</DialogTitle>
              <DialogDescription>
                {t('colegios.created.desc')}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t('colegios.col.name')}: </span>
                <span className="font-medium">{result.data.colegio.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('colegios.created.login')}: </span>
                <span className="font-medium">{result.data.colegio.subdomain}:5173</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('colegios.created.rector')}: </span>
                <span className="font-medium">{result.rectorEmail}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('colegios.created.password')}:</span>
                <div className="mt-1 rounded-md bg-muted px-2 py-1.5 font-mono text-foreground">
                  {result.data.rector_password}
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={resetAll}>
                {t('colegios.createAnother')}
              </Button>
              <Button onClick={() => setOpen(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('colegios.new.title')}</DialogTitle>
              <DialogDescription>
                {t('colegios.new.desc')}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <DialogBody className="space-y-4">
                  {form.formState.errors.root && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {form.formState.errors.root.message}
                    </p>
                  )}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('colegios.field.name')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Colegio San Jose"
                            {...field}
                            onChange={(event) => {
                              field.onChange(event);
                              if (!form.formState.dirtyFields.slug) {
                                form.setValue('slug', slugify(event.target.value), {
                                  shouldDirty: false,
                                });
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
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('colegios.col.subdomain')}</FormLabel>
                        <FormControl>
                          <Input placeholder="colegio-san-jose" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="legal_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('colegios.field.legalName')}{' '}
                            <span className="font-normal text-muted-foreground">({t('colegios.optional')})</span>
                          </FormLabel>
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
                          <FormLabel>
                            {t('colegios.field.nit')}{' '}
                            <span className="font-normal text-muted-foreground">({t('colegios.optional')})</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="900.123.456-7" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="rector_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('colegios.field.rectorName')}</FormLabel>
                        <FormControl>
                          <Input placeholder="Maria Rodriguez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rector_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('colegios.field.rectorEmail')}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="rector@colegio.edu.co" {...field} />
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
                        {planes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {plansLoading
                              ? t('colegios.plansLoading')
                              : plansError
                                ? t('colegios.plansError')
                                : t('colegios.plansEmpty')}
                          </p>
                        ) : (
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
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </DialogBody>

                <DialogFooter>
                  <Button type="submit" disabled={createColegio.isPending || planes.length === 0}>
                    {createColegio.isPending ? t('colegios.creating') : t('colegios.create')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
