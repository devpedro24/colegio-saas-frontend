import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { GraduationCap, BookOpen, HeartHandshake, CreditCard } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { useAuth } from './auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const loginSchema = z.object({
  email: z.string().min(1, 'El correo es obligatorio').email('Correo invalido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // El colegio se identifica por el subdominio (ej: colegio-rbac.localhost).
  const colegioSlug = window.location.hostname.split('.')[0];

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const user = await signIn(values.email, values.password);
      navigate(user.is_platform ? '/plataforma/colegios' : '/dashboard', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? (error.fieldError('email') ?? error.message)
          : t('login.error'),
      );
    }
  }

  const features = [
    { icon: BookOpen, label: t('login.f1') },
    { icon: HeartHandshake, label: t('login.f2') },
    { icon: CreditCard, label: t('login.f3') },
  ];

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Panel de marca (oculto en movil) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        {/* Adornos suaves de fondo */}
        <div className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -start-16 size-96 rounded-full bg-black/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="size-5" />
          </span>
          <span className="text-lg font-semibold">{t('login.brand')}</span>
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <h1 className="text-3xl font-semibold leading-snug tracking-tight">{t('login.tagline')}</h1>
          <ul className="space-y-4">
            {features.map((feature) => (
              <li key={feature.label} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <feature.icon className="size-4.5" />
                </span>
                <span className="text-sm text-primary-foreground/90">{feature.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-primary-foreground/60">
          {t('login.school')}: <span className="font-medium text-primary-foreground/80">{colegioSlug}</span>
        </div>
      </div>

      {/* Panel del formulario */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          {/* Marca compacta en movil */}
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-6" />
            </span>
            <span className="text-base font-semibold text-foreground">{t('login.brand')}</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('login.title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('login.welcome')} · <span className="font-medium text-foreground">{colegioSlug}</span>
            </p>
          </div>

          {formError && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="rector@colegio.edu.co"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login.password')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="********"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" size="lg" className="mt-2" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('login.submitting') : t('login.submit')}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
