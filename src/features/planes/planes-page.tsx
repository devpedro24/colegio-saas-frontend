import { useIntl } from 'react-intl';
import { Plus, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlanes } from './planes.api';
import { PlanFormDialog } from './components/plan-form-dialog';
import type { Plan, PlanCatalog } from './planes.types';

/** Panel del superadministrador: planes / membresias y sus configurables. */
export function PlanesPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { data, isLoading, isError } = usePlanes();

  return (
    <div className="container-fluid py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('planes.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('planes.description')}</p>
        </div>
        {data && (
          <PlanFormDialog
            catalog={data.catalog}
            trigger={
              <Button>
                <Plus className="size-4" />
                {t('planes.create')}
              </Button>
            }
          />
        )}
      </div>

      {isLoading && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      )}

      {isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('planes.loadError')}
        </p>
      )}

      {data && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.data.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('planes.empty')}</p>
          )}
          {data.data.map((plan) => (
            <PlanCard key={plan.id} plan={plan} catalog={data.catalog} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, catalog }: { plan: Plan; catalog: PlanCatalog }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const featureLabel = (key: string): string | null =>
    catalog.features.find((feature) => feature.key === key)?.label ?? null;

  const fmtLimit = (value: number | null, unit: string | null): string => {
    if (value === null) return t('planes.limit.unlimited');
    return unit ? `${value} ${t(unit)}` : String(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardHeading>
          <CardTitle>{plan.name}</CardTitle>
          {plan.description && <CardDescription>{plan.description}</CardDescription>}
        </CardHeading>
        <CardToolbar>
          <Badge variant={plan.is_active ? 'success' : 'secondary'} appearance="light">
            {t(plan.is_active ? 'planes.active' : 'planes.inactive')}
          </Badge>
        </CardToolbar>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Precio */}
        <div className="text-sm">
          {plan.price_monthly ? (
            <span className="text-lg font-semibold text-foreground">
              ${Number(plan.price_monthly).toLocaleString('es-CO')}
              <span className="ms-1 text-xs font-normal text-muted-foreground">{t('planes.perMonth')}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{t('planes.priceTbd')}</span>
          )}
        </div>

        {/* Limites */}
        <div className="grid grid-cols-2 gap-3">
          {catalog.limits.map((limit) => (
            <div key={limit.key}>
              <div className="text-xs text-muted-foreground">{t(limit.label)}</div>
              <div className="text-sm font-medium text-foreground">
                {fmtLimit(plan[limit.key], limit.unit)}
              </div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">
            {plan.features.length} {t('planes.featuresCount')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {plan.features.map((key) => {
              const label = featureLabel(key);
              return label ? (
                <Badge key={key} variant="outline" appearance="light">
                  {t(label)}
                </Badge>
              ) : null;
            })}
          </div>
        </div>

        <PlanFormDialog
          catalog={catalog}
          plan={plan}
          trigger={
            <Button variant="outline" className="w-full">
              <Pencil className="size-4" />
              {t('planes.edit')}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
