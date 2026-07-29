// Tipos del feature Planes (membresias SaaS de la BD central). Espeja
// colegio-saas-frontend/src/features/planes/planes.types.ts y el catalogo cerrado
// de features de colegio-saas-backend/app/Plans/PlanCatalog.php, simplificado para
// el diseno (solo UI, datos MOCK). Fase posterior puede extenderlo.

/** Periodicidad del precio del plan. */
export type PlanPeriod = 'mensual' | 'anual'

/**
 * Una feature del catalogo cerrado. El superadministrador NO inventa features,
 * solo activa/desactiva las de este catalogo dentro de cada plan.
 */
export interface PlanFeatureOption {
  key: string
  label: string
}

/** Un plan / membresia SaaS. */
export interface Plan {
  id: number
  /** Clave (slug) unica del plan. */
  key: string
  name: string
  description: string
  /** Precio en COP. null = por definir. */
  price: number | null
  period: PlanPeriod
  active: boolean
  /** Claves de feature activas (subconjunto de PLAN_FEATURES). */
  features: string[]
}
