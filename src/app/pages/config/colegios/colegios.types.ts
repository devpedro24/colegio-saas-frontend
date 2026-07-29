// Tipos del feature Colegios (tenants). Espeja colegio-saas-frontend/src/features/colegios/types.ts
// pero simplificado para el diseno (solo UI, datos MOCK). Fase 2 puede extenderlo.

/** Clave del plan del colegio (planes de la BD central). */
export type ColegioPlan = 'esencial' | 'estandar' | 'premium'

/** Estado del colegio (maquina de estados del tenant). */
export type ColegioStatus = 'active' | 'configuring' | 'provisioning' | 'suspended'

/** Rector del colegio (usuario principal del tenant). */
export interface Rector {
  name: string
  email: string
}

/** Un colegio / institucion registrada en la plataforma. */
export interface Colegio {
  id: number
  name: string
  subdomain: string
  plan: ColegioPlan
  status: ColegioStatus
  rector: Rector
}

/** Opcion de plan para los selects de los formularios (solo UI). */
export interface PlanOption {
  key: ColegioPlan
  label: string
}
