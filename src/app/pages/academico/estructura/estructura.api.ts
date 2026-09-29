// Capa de datos del feature Estructura organizacional: funciones del api client
// + hooks de TanStack Query. Todas bajo /api/estructura (permiso
// academico.estructura.gestionar). Dominio en espanol, alineado con el backend.

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAcademicYear} from '../academic-year-context'
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
const annualUrl = (path: string, yearId: string, key?: string, value?: string | null) => {
  const params = new URLSearchParams({ano_lectivo_id: yearId})
  if (key && value) params.set(key, value)
  return `${path}?${params}`
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

export function useSedes(enabled = true) {
  return useQuery({
    queryKey: SEDES_KEY,
    enabled,
    queryFn: () => api.get<{data: Sede[]}>('/estructura/sedes'),
  })
}

export function useSede(id: string | undefined) {
  return useQuery({
    queryKey: [...SEDES_KEY, id ?? '_'],
    enabled: id !== undefined && id !== null,
    queryFn: () => api.get<{data: Sede}>(`/estructura/sedes/${id}`),
  })
}

export interface SedeCreateResult {
  data: Sede
  coordinador_password?: string | null
}

export function useCreateSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSedeInput) => api.post<SedeCreateResult>('/estructura/sedes', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}

export function useUpdateSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateSedeInput}) =>
      api.put<{data: Sede}>(`/estructura/sedes/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}

export function useDeleteSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/sedes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}

// ---- Jornadas ----

export function useJornadas(sedeId?: string | null) {
  const {yearId} = useAcademicYear()
  return useQuery({
    queryKey: [...JORNADAS_KEY, yearId, sedeId ?? '_'],
    enabled: !!yearId && (sedeId === undefined || sedeId !== null),
    queryFn: () => api.get<{data: Jornada[]}>(annualUrl('/estructura/jornadas', yearId, 'sede_id', sedeId)),
  })
}

export function useCreateJornada() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateJornadaInput) => api.post<{data: Jornada}>('/estructura/jornadas', {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

export function useUpdateJornada() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: Partial<CreateJornadaInput>}) =>
      api.put<{data: Jornada}>(`/estructura/jornadas/${id}`, {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

export function useDeleteJornada() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/jornadas/${id}`, yearId)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

// ---- Niveles ----

export function useNiveles() {
  const {yearId} = useAcademicYear()
  return useQuery({
    queryKey: [...NIVELES_KEY, yearId], enabled: !!yearId,
    queryFn: () => api.get<{data: Nivel[]}>(annualUrl('/estructura/niveles', yearId)),
  })
}

export function useCreateNivel() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateNivelInput) => api.post<{data: Nivel}>('/estructura/niveles', {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

export function useUpdateNivel() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateNivelInput}) =>
      api.put<{data: Nivel}>(`/estructura/niveles/${id}`, {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

export function useDeleteNivel() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/niveles/${id}`, yearId)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

// ---- Grados ----

export function useGrados(nivelId?: string) {
  const {yearId} = useAcademicYear()
  return useQuery({
    queryKey: [...GRADOS_KEY, yearId],
    enabled: !!yearId && nivelId === undefined,
    queryFn: () => api.get<{data: Grado[]}>(annualUrl('/estructura/grados', yearId)),
  })
}

export function useCreateGrado() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateGradoInput) => api.post<{data: Grado}>('/estructura/grados', {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

export function useUpdateGrado() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateGradoInput}) =>
      api.put<{data: Grado}>(`/estructura/grados/${id}`, {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

export function useDeleteGrado() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/grados/${id}`, yearId)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

// ---- Grupos ----

export function useGrupos(anoLectivoId?: string) {
  const {yearId} = useAcademicYear()
  const selectedYear = anoLectivoId ?? yearId
  return useQuery({
    queryKey: [...GRUPOS_KEY, selectedYear],
    enabled: !!selectedYear,
    queryFn: () => api.get<{data: Grupo[]}>(annualUrl('/estructura/grupos', selectedYear)),
  })
}

export function useCreateGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGrupoInput) => api.post<{data: Grupo}>('/estructura/grupos', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRUPOS_KEY}),
  })
}

export function useUpdateGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateGrupoInput}) =>
      api.put<{data: Grupo}>(`/estructura/grupos/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRUPOS_KEY}),
  })
}

export function useDeleteGrupo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/grupos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRUPOS_KEY}),
  })
}

// ---- Bloques horarios ----

export function useBloquesHorarios(jornadaId?: string) {
  const {yearId} = useAcademicYear()
  return useQuery({
    queryKey: [...BLOQUES_KEY, yearId, jornadaId ?? '_all'],
    enabled: !!yearId && (jornadaId === undefined || jornadaId !== null),
    queryFn: () => api.get<{data: BloqueHorario[]}>(annualUrl('/estructura/bloques-horarios', yearId, 'jornada_id', jornadaId)),
  })
}

export function useCreateBloqueHorario() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateBloqueHorarioInput) =>
      api.post<{data: BloqueHorario}>('/estructura/bloques-horarios', {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

export function useUpdateBloqueHorario() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateBloqueHorarioInput}) =>
      api.put<{data: BloqueHorario}>(`/estructura/bloques-horarios/${id}`, {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

export function useDeleteBloqueHorario() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/bloques-horarios/${id}`, yearId)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

// ---- Espacios físicos ----

export function useEspaciosFisicos(sedeId?: string) {
  const {yearId} = useAcademicYear()
  return useQuery({
    queryKey: [...ESPACIOS_KEY, yearId, sedeId ?? '_all'],
    enabled: !!yearId && (sedeId === undefined || sedeId !== null),
    queryFn: () => api.get<{data: EspacioFisico[]}>(annualUrl('/estructura/espacios-fisicos', yearId, 'sede_id', sedeId)),
  })
}

export function useCreateEspacioFisico() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (input: CreateEspacioFisicoInput) =>
      api.post<{data: EspacioFisico}>('/estructura/espacios-fisicos', {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

export function useUpdateEspacioFisico() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateEspacioFisicoInput}) =>
      api.put<{data: EspacioFisico}>(`/estructura/espacios-fisicos/${id}`, {...input, ano_lectivo_id: yearId}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

export function useDeleteEspacioFisico() {
  const queryClient = useQueryClient()
  const {yearId} = useAcademicYear()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(annualUrl(`/estructura/espacios-fisicos/${id}`, yearId)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

/** POST /estructura/sedes/{id}/heredar — copia config del colegio a la sede. */
export function useHeredarSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, categorias}: {id: string; categorias: string[]}) =>
      api.post(`/estructura/sedes/${id}/heredar`, {categorias}),
    onSuccess: () => queryClient.invalidateQueries({queryKey: SEDES_KEY}),
  })
}
