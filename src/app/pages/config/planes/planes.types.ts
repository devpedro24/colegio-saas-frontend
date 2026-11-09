// Tipos del feature Planes (membresias SaaS de la BD central), alineados con el
// backend real (App\Http\Controllers\Api\Platform\PlanController + App\Plans\PlanCatalog).

/**
 * Un plan / membresia tal como lo devuelve el backend (metodo present()).
 * Ojo: los precios llegan como string (cast decimal de Laravel) o null.
 */
export interface Plan {
  pricing: PricingRules
  /** Clave (slug) unica del plan; el colegio referencia el plan por esta key. */
  key: string
  name: string
  description: string | null
  is_active: boolean
  /** Precios en COP. Strings numericos o null (por definir). */
  price_monthly: string | null
  price_annual: string | null
  /** Limites cuantitativos. null = ilimitado. */
  max_estudiantes: number | null
  storage_gb: number | null
  max_sedes: number | null
  max_pasarelas: number | null
  max_roles_personalizados: number | null
  /** Claves de feature activas (subconjunto del catalogo cerrado). */
  features: string[]
  sort_order: number
}

/** Una categoria para agrupar features. `label` es clave i18n (se muestra local). */
export interface PlanCategory {
  key: string
  label: string
}

/** Una feature del catalogo cerrado. `label`/`description` son claves i18n. */
export interface PlanFeature {
  available?: boolean
  key: string
  category: string
  label: string
  description: string
  required?: boolean
}

/** Un limite cuantitativo del catalogo. `label`/`unit` son claves i18n. */
export interface PlanLimit {
  key: 'max_estudiantes' | 'storage_gb' | 'max_sedes' | 'max_pasarelas' | 'max_roles_personalizados'
  label: string
  unit: string | null
}

/** Catalogo CERRADO que acompana al listado de planes (GET /plans). */
export interface PlanCatalog {
  categories: PlanCategory[]
  features: PlanFeature[]
  limits: PlanLimit[]
}

/** Respuesta de GET /plans. */
export interface PlanesResponse {
  data: Plan[]
  catalog: PlanCatalog
}

/** Payload para crear/actualizar un plan (POST /plans, PUT /plans/{id}). */
export interface PlanInput {
  pricing?: PricingRules
  key: string
  name: string
  description: string | null
  is_active: boolean
  price_monthly: number | null
  price_annual: number | null
  max_estudiantes: number | null
  storage_gb: number | null
  max_sedes: number | null
  max_pasarelas: number | null
  max_roles_personalizados: number | null
  features: string[]
  sort_order?: number
}

export type PricingRules = {currency: 'COP'; student_monthly: number; minimum_students: number;
  included_sites: number; additional_site_monthly: number; addons: Record<string, number>}
export type SubscriptionInput = {students: number; sites: number; addons: string[]; discount_percent?: number; customized?: boolean; pricing_override?: Pick<PricingRules, 'student_monthly' | 'included_sites' | 'additional_site_monthly'> | null}
export type SubscriptionQuote = {currency: string; students: number; sites: number; addons: string[];
  base_student_monthly: number; student_monthly: number; students_total: number;
  addon_lines: {key: string; unit: number; quantity: number; total: number}[];
  additional_sites: number; sites_total: number; subtotal: number; discount_percent: number; discount_total: number;
  monthly_total: number; annual_reference: number}
