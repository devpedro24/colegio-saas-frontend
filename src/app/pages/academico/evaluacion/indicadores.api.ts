import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

export type IndicatorItem = {
  indicador_token: string
  vinculo_token: string
  texto: string
  texto_base: string
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
export type IndicatorPolicy = {alcance: 'grado' | 'grupo' | 'mixto'; docente_puede_editar: boolean;
  version: number; configurado: boolean; indicadores_grado: number; indicadores_grupo: number}
export type AssignedIndicatorOptions = {
  anos: Array<{token: string; nombre: string; estado: string}>
  grupos: Array<{token: string; ano_token: string; grado_token: string; nombre: string;
    grado_nombre: string; materias: Array<{token: string; nombre: string}>}>
  periodos: Array<{token: string; ano_token: string; nombre: string; orden: number; estado: string}>
}
export type GroupIndicatorSheet = {grupo_token: string; periodo_token: string; materias: Array<{
  materia_token: string; materia: string; texto_html: string; version: number; puede_editar: boolean
}>}

function useScope() {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  return [currentUser?.tenant_channel ?? '', activeColegio?.slug ?? '', currentUser?.id ?? ''] as const
}

export function useAssignedIndicatorOptions() {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'opciones-asignadas', ...scope],
    queryFn: () => api.get<{data: AssignedIndicatorOptions}>('/indicadores/opciones-asignadas?opaque=1')
      .then(res => res.data)})
}

export function useIndicatorPolicy(year: string) {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'politica', ...scope, year], enabled: !!year,
    queryFn: () => api.get<{data: IndicatorPolicy}>(`/indicadores/politica/${encodeURIComponent(year)}?opaque=1`).then(res => res.data)})
}

export function useGroupIndicatorSheet(group: string, period: string) {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'tabla', ...scope, group, period], enabled: !!group && !!period,
    queryFn: () => {
      const params = new URLSearchParams({opaque: '1', grupo_token: group, periodo_token: period})
      return api.get<{data: GroupIndicatorSheet}>(`/indicadores/tabla?${params}`).then(res => res.data)
    }})
}

export function useSaveGroupIndicatorSheet() {
  const client = useQueryClient()
  return useMutation({mutationFn: (input: {group: string; period: string; subject: string; html: string; version: number}) =>
    api.put(`/indicadores/tabla/${encodeURIComponent(input.subject)}?opaque=1`, {
      grupo_token: input.group, periodo_token: input.period, texto_html: input.html, version: input.version,
    }), onSuccess: () => {
      void client.invalidateQueries({queryKey: ['indicadores']})
      void client.invalidateQueries({queryKey: ['boletines', 'emisiones']})
    }})
}

export function useDeleteGroupIndicatorSheet() {
  const client = useQueryClient()
  return useMutation({mutationFn: (input: {group: string; period: string; subject: string; version: number}) => {
    const params = new URLSearchParams({opaque: '1', grupo_token: input.group,
      periodo_token: input.period, version: String(input.version)})
    return api.delete(`/indicadores/tabla/${encodeURIComponent(input.subject)}?${params}`)
  }, onSuccess: () => {
    void client.invalidateQueries({queryKey: ['indicadores']})
    void client.invalidateQueries({queryKey: ['boletines', 'emisiones']})
  }})
}

export function useSaveIndicatorPolicy(year: string) {
  const client = useQueryClient()
  return useMutation({mutationFn: (input: {version: number; alcance: 'grado' | 'grupo';
    docente_puede_editar: boolean; confirmar_copia: boolean}) =>
    api.put<{data: IndicatorPolicy}>(`/indicadores/politica/${encodeURIComponent(year)}?opaque=1`, input).then(res => res.data),
    onSuccess: () => {void client.invalidateQueries({queryKey: ['indicadores']}); void client.invalidateQueries({queryKey: ['boletines', 'emisiones']})}})
}

export function useIndicatorDrafts(year: string, grade: string, subject: string, period: string) {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'borradores', ...scope, year, grade, subject, period],
    enabled: !!year && !!grade && !!subject && !!period,
    queryFn: () => {
      const params = new URLSearchParams({opaque: '1', ano_token: year, grado_token: grade,
        materia_token: subject, periodo_token: period})
      return api.get<{data: Array<{texto: string}>}>(`/indicadores/borradores?${params}`).then(res => res.data)
    }})
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

export function useIndicatorBindings(year: string, grade: string, subject: string, period: string, page = 1) {
  const scope = useScope()
  return useQuery({queryKey: ['indicadores', 'vinculos', ...scope, year, grade, subject, period, page],
    enabled: !!year && !!grade && !!subject && !!period,
    queryFn: () => {
      const params = new URLSearchParams({opaque: '1', ano_token: year, grado_token: grade,
        materia_token: subject, periodo_token: period, page: String(page)})
      return api.get<{data: IndicatorBinding[]; meta: {pagina: number; ultima_pagina: number; total: number}}>(`/indicadores/vinculos?${params}`)
    }})
}

export function useIndicatorActions() {
  const client = useQueryClient()
  const refresh = () => {
    void client.invalidateQueries({queryKey: ['indicadores']})
    void client.invalidateQueries({queryKey: ['boletines', 'emisiones']})
  }
  return {
    create: useMutation({mutationFn: (input: {ano_token: string; grado_token: string; materia_token: string;
      texto: string; orden: number; periodos_orden: number[] | null}) =>
      api.post('/indicadores?opaque=1', input), onSuccess: refresh}),
    createGroup: useMutation({mutationFn: (input: {grupo_token: string; materia_token: string;
      periodo_token: string; texto: string}) =>
      api.post('/indicadores/grupo?opaque=1', input), onSuccess: refresh}),
    bind: useMutation({mutationFn: ({indicator, input}: {indicator: string; input: {ano_token: string; grado_token: string;
      materia_token: string; periodos_orden: number[] | null}}) =>
      api.post(`/indicadores/${encodeURIComponent(indicator)}/vinculos?opaque=1`, input), onSuccess: refresh}),
    revise: useMutation({mutationFn: ({indicator, input}: {indicator: string; input: {version: number; texto: string; orden: number}}) =>
      api.put(`/indicadores/${encodeURIComponent(indicator)}?opaque=1`, input), onSuccess: refresh}),
    updateBinding: useMutation({mutationFn: ({binding, input}: {binding: string; input: {version: number;
      periodos_orden: number[] | null; usar_revision_actual: boolean}}) =>
      api.put(`/indicadores/vinculos/${encodeURIComponent(binding)}?opaque=1`, input), onSuccess: refresh}),
    editGradeText: useMutation({mutationFn: ({binding, input}: {binding: string; input: {version: number; texto: string}}) =>
      api.put(`/indicadores/vinculos/${encodeURIComponent(binding)}/texto?opaque=1`, input), onSuccess: refresh}),
    variant: useMutation({mutationFn: ({binding, input}: {binding: string; input: {grupo_token: string;
      periodo_orden: number; texto: string; version: number}}) =>
      api.put(`/indicadores/vinculos/${encodeURIComponent(binding)}/variante?opaque=1`, input), onSuccess: refresh}),
  }
}
