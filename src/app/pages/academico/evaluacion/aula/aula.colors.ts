import type {CSSProperties} from 'react'
import type {AulaDetail} from './aula.api'

const fallback = ['#2563EB', '#0891B2', '#7C3AED', '#D97706']

export function periodAccent(aula: AulaDetail, periodToken: string): CSSProperties {
  const order = aula.periodos.find(period => period.token === periodToken)?.orden ?? 1
  return {'--aula-period-accent': aula.colores_periodos?.[String(order)] || fallback[(order - 1) % fallback.length]} as CSSProperties
}

export function preinformeAccent(aula: AulaDetail): CSSProperties {
  return {'--aula-preinforme-accent': aula.color_preinforme || '#64748B'} as CSSProperties
}
