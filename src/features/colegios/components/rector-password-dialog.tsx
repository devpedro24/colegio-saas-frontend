import { ReactNode, useState } from 'react';
import { useIntl } from 'react-intl';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useResetRectorPassword } from '../colegios.api';
import type { Colegio, ResetPasswordResponse } from '../types';

interface Props {
  colegio: Colegio;
  trigger: ReactNode;
}

/**
 * Contrasena del rector: como se guarda cifrada, no se puede recuperar la
 * anterior; se regenera una nueva y se muestra una sola vez.
 */
export function RectorPasswordDialog({ colegio, trigger }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ResetPasswordResponse | null>(null);
  const reset = useResetRectorPassword();

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      reset.reset();
    }
  }

  async function regenerate() {
    const data = await reset.mutateAsync(colegio.id);
    setResult(data);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('colegios.pwd.newTitle')}</DialogTitle>
              <DialogDescription>{t('colegios.pwd.once')}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t('colegios.col.name')}: </span>
                <span className="font-medium">{colegio.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('colegios.created.rector')}: </span>
                <span className="font-medium">{result.rector_email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('colegios.created.password')}:</span>
                <div className="mt-1 rounded-md bg-muted px-2 py-1.5 font-mono text-foreground">
                  {result.rector_password}
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => close(false)}>{t('common.close')}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('colegios.pwd.title')}</DialogTitle>
              <DialogDescription>{t('colegios.pwd.desc')}</DialogDescription>
            </DialogHeader>
            <DialogBody className="text-sm text-muted-foreground">
              {colegio.name} · {colegio.subdomain}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                {t('common.close')}
              </Button>
              <Button onClick={regenerate} disabled={reset.isPending}>
                <KeyRound className="size-4" />
                {reset.isPending ? t('colegios.pwd.regenerating') : t('colegios.pwd.regenerate')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
