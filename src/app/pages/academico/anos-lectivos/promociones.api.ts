import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

export interface PromocionPropuesta {
  estado: 'pendiente' | 'calculada'
  motivos?: string[]
  resultado?: 'promovido' | 'reprobado'
  numero_reprobadas?: number
  numero_obligatorias_reprobadas?: number
  promedio?: string
  promedio_cumple?: boolean
  huella?: string
}

export interface PromocionRegistro {
  matricula_token: string
  estudiante: string
  grado: string
  grado_token: string
  grupo: string
  propuesta: PromocionPropuesta
  decision: null | {
    resultado: string
    grado_destino_token: string | null
    motivo: string
    version: number
    vigente: boolean
    aprobada_en: string
  }
}

export interface PromocionResumen {
  data: PromocionRegistro[]
  meta: {current_page: number; last_page: number; total: number}
  politica: null | {
    max_reprobadas: number
    materias_obligatorias: string[]
    promedio_minimo: string | null
    version: number
  }
  materias: {token: string; nombre: string}[]
  grados: {token: string; nombre: string}[]
  grupos: {token: string; nombre: string}[]
}

const key = (ano: string, page: number, group: string) => ['anos-lectivos', ano, 'promociones', page, group] as const

export function usePromociones(ano: string | null, page: number, group = '') {
  return useQuery({
    queryKey: key(ano ?? '', page, group),
    enabled: !!ano,
    queryFn: () => api.get<PromocionResumen>(`/anos-lectivos/${ano}/promociones?opaque=1&page=${page}${group ? `&grupo_token=${encodeURIComponent(group)}` : ''}`),
  })
}

export function useGuardarPolitica(ano: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {max_reprobadas: number; materias_obligatorias: string[]; promedio_minimo: string | null; version: number}) =>
      api.put(`/anos-lectivos/${ano}/promociones/politica?opaque=1`, input),
    onSuccess: () => client.invalidateQueries({queryKey: ['anos-lectivos', ano]}),
  })
}

export function useAprobarPromocion(ano: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({matricula, input}: {matricula: string; input: {
      huella: string; resultado: string; grado_destino_token: string | null; motivo: string; version: number
    }}) => api.put(`/anos-lectivos/${ano}/promociones/${matricula}?opaque=1`, input),
    onSuccess: () => client.invalidateQueries({queryKey: ['anos-lectivos', ano]}),
  })
}
