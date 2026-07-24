/** Un plan / membresia SaaS (BD central). */
export interface Plan {
  id: number;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  price_monthly: string | null;
  price_annual: string | null;
  /** Limites cuantitativos. null = ilimitado. */
  max_estudiantes: number | null;
  storage_gb: number | null;
  max_sedes: number | null;
  max_pasarelas: number | null;
  /** Claves de feature activas (subconjunto del catalogo). */
  features: string[];
  sort_order: number;
}

/** Una categoria para agrupar features en la UI. `label` es clave i18n. */
export interface PlanCategory {
  key: string;
  label: string;
}

/** Una feature del catalogo cerrado. `label`/`description` son claves i18n. */
export interface PlanFeature {
  key: string;
  category: string;
  label: string;
  description: string;
}

/** Un limite cuantitativo del catalogo. `label`/`unit` son claves i18n. */
export interface PlanLimit {
  key: 'max_estudiantes' | 'storage_gb' | 'max_sedes' | 'max_pasarelas';
  label: string;
  unit: string | null;
}

/** Catalogo cerrado que acompana al listado de planes. */
export interface PlanCatalog {
  categories: PlanCategory[];
  features: PlanFeature[];
  limits: PlanLimit[];
}

export interface PlanesResponse {
  data: Plan[];
  catalog: PlanCatalog;
}

/** Payload para crear/actualizar un plan. */
export interface PlanInput {
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  price_monthly: number | null;
  price_annual: number | null;
  max_estudiantes: number | null;
  storage_gb: number | null;
  max_sedes: number | null;
  max_pasarelas: number | null;
  features: string[];
}
