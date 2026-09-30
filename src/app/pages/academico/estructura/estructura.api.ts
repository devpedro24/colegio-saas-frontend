// Capa de datos del feature Estructura organizacional: funciones del api client
// + hooks de TanStack Query. Todas bajo /api/estructura (permiso
// academico.estructura.gestionar). Dominio en espanol, alineado con el backend.

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {completeAcademicPage} from '@/lib/api/academic-cache'
import {useAcademicYear} from '../academic-year-context'
import {fromOpaqueAcademic, opaqueParams, toOpaqueAcademic} from '../shared/opaqueAcademic'
import type {
  BloqueHorario,
  CreateBloqueHorarioInput,
  CreateEspacioFisicoInput,
  CreateGradoInput,
  CreateGrupoInput,
  CreateJornadaInput,
  CreateNivelInput,
  CreateSedeInput,
  EspacioFisico,
  Grado,
  Grupo,
  Jornada,
  Nivel,
  Sede,
} from './estructura.types'

/** Claves de cache por entidad. */
export const SEDES_KEY = ['estructura', 'sedes'] as const
export const JORNADAS_KEY = ['estructura', 'jornadas'] as const
export const NIVELES_KEY = ['estructura', 'niveles'] as const
export const GRADOS_KEY = ['estructura', 'grados'] as const
export const GRUPOS_KEY = ['estructura', 'grupos'] as const
export const BLOQUES_KEY = ['estructura', 'bloques-horarios'] as const
export const ESPACIOS_KEY = ['estructura', 'espacios-fisicos'] as const
export type AcademicPageMeta = {current_page: number; per_page: number; last_page: number; total: number; from: number | null; to: number | null}
export type AcademicPaged<T> = {data: T[]; meta: AcademicPageMeta}
export type AcademicListParams = {page: number; perPage: number; search?: string; filters?: Record<string, string>}
const listUrl = (path: string, yearId: string, params: AcademicListParams) => {
  const query = new URLSearchParams({ano_lectivo_id: yearId, page: String(params.page), per_page: String(params.perPage)})
  if (params.search?.trim()) query.set('search', params.search.trim())
  Object.entries(params.filters ?? {}).forEach(([name, value]) => {if (value) query.set(name, value)})
  return `${path}?${opaqueParams(query)}`
}
export function getEstructuraPage<T>(entity: 'jornadas' | 'niveles' | 'grados' | 'grupos' | 'bloques-horarios' | 'espacios-fisicos', yearId: string, params: AcademicListParams) {
  return api.get<AcademicPaged<unknown>>(listUrl(`/estructura/${entity}`, yearId, params))
    .then(result => ({...result, data: fromOpaqueAcademic<T[]>(result.data)}))
}
const annualUrl = (path: string, yearId: string, key?: string, value?: string | null) => {
  const params = new URLSearchParams({ano_lectivo_id: yearId})
  if (key && value) params.set(key, value)
  return `${path}?${opaqueParams(params)}`
}

/**
 * URL de una sede adicional: su tenant vive en `https://{tenant_domain}.{base}` donde
 * `base` es el hostname actual menos el primer segmento. Desde el colegio
 * (colegio-rbac.localhost) â†’ base = localhost; desde una sede (norte.colegio-rbac.localhost)
 * â†’ base = colegio-rbac.localhost.
 */
export function sedeSubdomainUrl(tenantDomain: string): string {
  const host = window.location.hostname
  const parts = host.split('.')
  const base = parts.length > 1 ? parts.slice(1).join('.') : host
  return `${window.location.protocol}//${tenantDomain}.${base}`
}

// ---- Sedes ----

export function useSedes(enabled = true, forSelect = false, params?: AcademicListParams, opaque = true) {
  const client = useQueryClient()
  const query = new URLSearchParams({page: String(params?.page ?? 1), per_page: String(params?.perPage ?? (forSelect ? 1000 : 20))})
  if (params?.search?.trim()) query.set('search', params.search.trim())
  return useQuery({
    queryKey: [...SEDES_KEY, opaque ? 'opaque' : 'legacy', forSelect ? 'options' : 'list', params?.page ?? 1, params?.perPage ?? (forSelect ? 1000 : 20), params?.search ?? ''],
    enabled,
    queryFn: async () => {
      if (forSelect && !params?.search?.trim()) {
        const cached = client.getQueryCache().findAll({queryKey: [...SEDES_KEY, opaque ? 'opaque' : 'legacy', 'list']})
          .find(item => item.queryKey[4] === 1 && !item.queryKey[6] && !item.state.isInvalidated && item.state.fetchStatus === 'idle'
            && (item.state.data as AcademicPaged<Sede> | undefined)?.meta?.total === (item.state.data as AcademicPaged<Sede> | undefined)?.data?.length)
        if (cached?.state.data) return cached.state.data as AcademicPaged<Sede>
      }
      const result = await api.get<AcademicPaged<Sede>>(`/estructura/sedes?${opaque ? opaqueParams(query) : query}`)
      return opaque ? {...result, data: fromOpaqueAcademic<Sede[]>(result.data)} : result
    },
  })
}

export function useSede(id: string | undefined) {
  return useQuery({
    queryKey: [...SEDES_KEY, id ?? '_'],
    enabled: id !== undefined && id !== null,
    queryFn: async () => {
      const result = await api.get<{data: Sede}>(`/estructura/sedes/${encodeURIComponent(id!)}?opaque=1`)
      return {...result, data: fromOpaqueAcademic<Sede>(result.data)}
    },
  })
}

export interface SedeCreateResult {
  data: Sede
  coordinador_password?: string | null
}

export function useCreateSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSedeInput) => api.post<SedeCreateResult>('/estructura/sedes?opaque=1', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}

export function useUpdateSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateSedeInput}) =>
      api.put<{data: Sede}>(`/estructura/sedes/${encodeURIComponent(id)}?opaque=1`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}

export function useDeleteSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/sedes/${encodeURIComponent(id)}?opaque=1`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}

// ---- Jornadas ----

export function useJornadas(sedeId?: string | null) {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useQuery({
    queryKey: [...JORNADAS_KEY, yearToken, sedeId ?? '_'],
    enabled: !!yearToken && (sedeId === undefined || sedeId !== null),
    queryFn: async () => {
      const cached = !sedeId && completeAcademicPage<Jornada>(client, [...JORNADAS_KEY, yearToken])
      if (cached) return cached
      const result = await api.get<{data: Jornada[]}>(`${annualUrl('/estructura/jornadas', yearToken, 'sede_id', sedeId)}&per_page=1000`)
      return {...result, data: fromOpaqueAcademic<Jornada[]>(result.data)}
    },
  })
}

export function useCreateJornada() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateJornadaInput) => api.post<{data: Jornada}>('/estructura/jornadas?opaque=1', toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

export function useUpdateJornada() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: Partial<CreateJornadaInput>}) =>
      api.put<{data: Jornada}>(`/estructura/jornadas/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

export function useDeleteJornada() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/jornadas/${encodeURIComponent(id)}`, yearToken)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

// ---- Niveles ----

export function useNiveles() {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useQuery({
    queryKey: [...NIVELES_KEY, yearToken], enabled: !!yearToken,
    queryFn: async () => {
      const cached = completeAcademicPage<Nivel>(client, [...NIVELES_KEY, yearToken])
      if (cached) return cached
      const result = await api.get<{data: Nivel[]}>(`${annualUrl('/estructura/niveles', yearToken)}&per_page=1000`)
      return {...result, data: fromOpaqueAcademic<Nivel[]>(result.data)}
    },
  })
}

export function useCreateNivel() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateNivelInput) => api.post<{data: Nivel}>('/estructura/niveles?opaque=1', toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

export function useUpdateNivel() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateNivelInput}) =>
      api.put<{data: Nivel}>(`/estructura/niveles/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

export function useDeleteNivel() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/niveles/${encodeURIComponent(id)}`, yearToken)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

// ---- Grados ----

export function useGrados(nivelId?: string) {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useQuery({
    queryKey: [...GRADOS_KEY, yearToken],
    enabled: !!yearToken && nivelId === undefined,
    queryFn: async () => {
      const cached = completeAcademicPage<Grado>(client, [...GRADOS_KEY, yearToken])
      if (cached) return cached
      const result = await api.get<{data: Grado[]}>(`${annualUrl('/estructura/grados', yearToken)}&per_page=1000`)
      return {...result, data: fromOpaqueAcademic<Grado[]>(result.data)}
    },
  })
}

export function useCreateGrado() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateGradoInput) => api.post<{data: Grado}>('/estructura/grados?opaque=1', toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

export function useUpdateGrado() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateGradoInput}) =>
      api.put<{data: Grado}>(`/estructura/grados/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

export function useDeleteGrado() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/grados/${encodeURIComponent(id)}`, yearToken)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

// ---- Grupos ----

export function useGrupos(anoLectivoId?: string) {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  const selectedYear = anoLectivoId ?? yearToken
  return useQuery({
    queryKey: [...GRUPOS_KEY, selectedYear],
    enabled: !!selectedYear,
    queryFn: async () => {
      const cached = completeAcademicPage<Grupo>(client, [...GRUPOS_KEY, selectedYear])
      if (cached) return cached
      const result = await api.get<{data: Grupo[]}>(`${annualUrl('/estructura/grupos', selectedYear)}&per_page=20`)
      return {...result, data: fromOpaqueAcademic<Grupo[]>(result.data)}
    },
  })
}

export function useCreateGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGrupoInput) => api.post<{data: Grupo}>('/estructura/grupos?opaque=1', toOpaqueAcademic(input)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRUPOS_KEY}),
  })
}

export function useUpdateGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateGrupoInput}) =>
      api.put<{data: Grupo}>(`/estructura/grupos/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic(input)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRUPOS_KEY}),
  })
}

export function useDeleteGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/grupos/${encodeURIComponent(id)}?opaque=1`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRUPOS_KEY}),
  })
}

// ---- Bloques horarios ----

export function useBloquesHorarios(jornadaId?: string) {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useQuery({
    queryKey: [...BLOQUES_KEY, yearToken, jornadaId ?? '_all'],
    enabled: !!yearToken && (jornadaId === undefined || jornadaId !== null),
    queryFn: async () => {
      const cached = !jornadaId && completeAcademicPage<BloqueHorario>(client, [...BLOQUES_KEY, yearToken])
      if (cached) return cached
      const result = await api.get<{data: BloqueHorario[]}>(`${annualUrl('/estructura/bloques-horarios', yearToken, 'jornada_id', jornadaId)}&per_page=1000`)
      return {...result, data: fromOpaqueAcademic<BloqueHorario[]>(result.data)}
    },
  })
}

export function useCreateBloqueHorario() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateBloqueHorarioInput) =>
      api.post<{data: BloqueHorario}>('/estructura/bloques-horarios?opaque=1', toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

export function useUpdateBloqueHorario() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateBloqueHorarioInput}) =>
      api.put<{data: BloqueHorario}>(`/estructura/bloques-horarios/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

export function useDeleteBloqueHorario() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/bloques-horarios/${encodeURIComponent(id)}`, yearToken)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

// ---- Espacios físicos ----

export function useEspaciosFisicos(sedeId?: string) {
  const client = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useQuery({
    queryKey: [...ESPACIOS_KEY, yearToken, sedeId ?? '_all'],
    enabled: !!yearToken && (sedeId === undefined || sedeId !== null),
    queryFn: async () => {
      const cached = !sedeId && completeAcademicPage<EspacioFisico>(client, [...ESPACIOS_KEY, yearToken])
      if (cached) return cached
      const result = await api.get<{data: EspacioFisico[]}>(`${annualUrl('/estructura/espacios-fisicos', yearToken, 'sede_id', sedeId)}&per_page=20`)
      return {...result, data: fromOpaqueAcademic<EspacioFisico[]>(result.data)}
    },
  })
}

export function useCreateEspacioFisico() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateEspacioFisicoInput) =>
      api.post<{data: EspacioFisico}>('/estructura/espacios-fisicos?opaque=1', toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

export function useUpdateEspacioFisico() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateEspacioFisicoInput}) =>
      api.put<{data: EspacioFisico}>(`/estructura/espacios-fisicos/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic({...input, ano_lectivo_id: yearToken})),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

export function useDeleteEspacioFisico() {
  const queryClient = useQueryClient()
  const {yearToken} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/espacios-fisicos/${encodeURIComponent(id)}`, yearToken)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

/** POST /estructura/sedes/{id}/heredar — copia config del colegio a la sede. */
export function useHeredarSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, categorias}: {id: string; categorias: string[]}) =>
      api.post(`/estructura/sedes/${encodeURIComponent(id)}/heredar?opaque=1`, {categorias}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}
