import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

export type IndicatorItem = {
  indicador_token: string
  vinculo_token: string
  texto: string
  texto_base: string
  fuente: 'grupo' | 'institucional'
  revision: number
  version_vinculo: number
  version_variante: number
  periodos_orden: number[] | null
}
export type IndicatorCatalog = {
  periodo_token: string
  indicadores: IndicatorItem[]
  pagina: number
  ultima_pagina: number
  total: number
}
export type IndicatorBase = {indicador_token: string; texto: string; version: number; orden: number}
export type IndicatorBinding = {indicador_token: string; vinculo_token: string; texto_base: string; version_base: number;
  texto_vinculado: string; revision_vinculada: number; orden: number; periodos_orden: number[] | null; version_vinculo: number}
export type IndicatorSetup = {grados: Array<{token: string; nombre: string}>;
  materias: Array<{token: string; nombre: string}>;
  periodos: Array<{token: string; nombre: string; orden: number; estado: string}>}
export type IndicatorContext = {year: string; grade: string; group: string; subject: string; period: string; periodOrder: number}

function useScope() {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return [currentUser?.tenant_channel ?? '', activeColegio?.slug ?? '', currentUser?.id ?? ''] as const
}

export function useIndicatorCatalog(context: IndicatorContext | null, page = 1) {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'catalogo', ...scope, context?.group, context?.subject, context?.period, page],
    enabled: !!context, queryFn: () => {
      const params = new URLSearchParams({opaque: '1', grupo_token: context!.group,
        materia_token: context!.subject, periodo_token: context!.period, page: String(page)})
      return api.get<{data: IndicatorCatalog}>(`/indicadores?${params}`).then(res => res.data)
    }})
}

export function useIndicatorBases(enabled: boolean, search = '') {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'bases', ...scope, search], enabled,
    queryFn: () => api.get<{data: IndicatorBase[]; meta: {pagina: number; ultima_pagina: number; total: number}}>(
      `/indicadores/bases?opaque=1&search=${encodeURIComponent(search)}`).then(res => res)})
}

export function useIndicatorSetup(year: string, grade = '') {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'contexto', ...scope, year, grade], enabled: !!year,
    queryFn: () => api.get<{data: IndicatorSetup}>(`/indicadores/contexto/${encodeURIComponent(year)}?opaque=1${grade ? `&grado_token=${encodeURIComponent(grade)}` : ''}`)
      .then(res => res.data)})
}

export function useIndicatorBindings(year: string, grade: string, subject: string, page = 1) {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'vinculos', ...scope, year, grade, subject, page],
    enabled: !!year && !!grade && !!subject,
    queryFn: () => {
      const params = new URLSearchParams({opaque: '1', ano_token: year, grado_token: grade, materia_token: subject, page: String(page)})
      return api.get<{data: IndicatorBinding[]; meta: {pagina: number; ultima_pagina: number; total: number}}>(`/indicadores/vinculos?${params}`)
    }})
}

export function useIndicatorActions() {
  const client = useQueryClient()
  const refresh = () => {
    void client.invalidateQueries({queryKey: ['indicadores']})
    void client.invalidateQueries({queryKey: ['boletines']})
  }
  return {
    create: useMutation({mutationFn: (input: {ano_token: string; grado_token: string; materia_token: string;
      texto: string; orden: number; periodos_orden: number[] | null}) =>
      api.post('/indicadores?opaque=1', input), onSuccess: refresh}),
    bind: useMutation({mutationFn: ({indicator, input}: {indicator: string; input: {ano_token: string; grado_token: string;
      materia_token: string; periodos_orden: number[] | null}}) =>
      api.post(`/indicadores/${encodeURIComponent(indicator)}/vinculos?opaque=1`, input), onSuccess: refresh}),
    revise: useMutation({mutationFn: ({indicator, input}: {indicator: string; input: {version: number; texto: string; orden: number}}) =>
      api.put(`/indicadores/${encodeURIComponent(indicator)}?opaque=1`, input), onSuccess: refresh}),
    updateBinding: useMutation({mutationFn: ({binding, input}: {binding: string; input: {version: number;
      periodos_orden: number[] | null; usar_revision_actual: boolean}}) =>
      api.put(`/indicadores/vinculos/${encodeURIComponent(binding)}?opaque=1`, input), onSuccess: refresh}),
    variant: useMutation({mutationFn: ({binding, input}: {binding: string; input: {grupo_token: string;
      periodo_orden: number; texto: string; version: number}}) =>
      api.put(`/indicadores/vinculos/${encodeURIComponent(binding)}/variante?opaque=1`, input), onSuccess: refresh}),
  }
}
