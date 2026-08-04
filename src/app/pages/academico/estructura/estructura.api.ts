// Capa de datos del feature Estructura organizacional: funciones del api client
// + hooks de TanStack Query. Todas bajo /api/estructura (permiso
// academico.estructura.gestionar). Dominio en espanol, alineado con el backend.

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
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

// ---- Sedes ----

export function useSedes(enabled = true) {
  return useQuery({
    queryKey: SEDES_KEY,
    enabled,
    queryFn: () => api.get<{data: Sede[]}>('/estructura/sedes').then((res) => res.data),
  })
}

export function useSede(id: string | undefined) {
  return useQuery({
    queryKey: [...SEDES_KEY, id ?? '_'],
    enabled: id !== undefined && id !== null,
    queryFn: () => api.get<{data: Sede}>(`/estructura/sedes/${id}`).then((res) => res.data),
  })
}

export function useCreateSede() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSedeInput) => api.post<{data: Sede}>('/estructura/sedes', input),
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
  return useQuery({
    queryKey: [...JORNADAS_KEY, sedeId ?? '_'],
    enabled: sedeId === undefined || sedeId !== null, // sin filtro => lista completa
    queryFn: () => {
      const q = sedeId ? `?sede_id=${sedeId}` : ''
      return api.get<{data: Jornada[]}>(`/estructura/jornadas${q}`).then((res) => res.data)
    },
  })
}

export function useCreateJornada() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateJornadaInput) => api.post<{data: Jornada}>('/estructura/jornadas', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

export function useUpdateJornada() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: Partial<CreateJornadaInput>}) =>
      api.put<{data: Jornada}>(`/estructura/jornadas/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

export function useDeleteJornada() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/jornadas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: JORNADAS_KEY}),
  })
}

// ---- Niveles ----

export function useNiveles() {
  return useQuery({
    queryKey: NIVELES_KEY,
    queryFn: () => api.get<{data: Nivel[]}>('/estructura/niveles').then((res) => res.data),
  })
}

export function useCreateNivel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateNivelInput) => api.post<{data: Nivel}>('/estructura/niveles', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

export function useUpdateNivel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateNivelInput}) =>
      api.put<{data: Nivel}>(`/estructura/niveles/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

export function useDeleteNivel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/niveles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: NIVELES_KEY}),
  })
}

// ---- Grados ----

export function useGrados(nivelId?: string) {
  return useQuery({
    queryKey: GRADOS_KEY,
    enabled: nivelId === undefined, // filtro por nivel se delibera en componente
    queryFn: () => api.get<{data: Grado[]}>('/estructura/grados').then((res) => res.data),
  })
}

export function useCreateGrado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateGradoInput) => api.post<{data: Grado}>('/estructura/grados', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

export function useUpdateGrado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateGradoInput}) =>
      api.put<{data: Grado}>(`/estructura/grados/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

export function useDeleteGrado() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/grados/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: GRADOS_KEY}),
  })
}

// ---- Grupos ----

export function useGrupos(anoLectivoId?: string) {
  return useQuery({
    queryKey: [...GRUPOS_KEY, anoLectivoId ?? '_all'],
    enabled: anoLectivoId === undefined || anoLectivoId !== null,
    queryFn: () => {
      const params = anoLectivoId ? `?ano_lectivo_id=${anoLectivoId}` : ''
      return api.get<{data: Grupo[]}>(`/estructura/grupos${params}`).then((res) => res.data)
    },
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
  return useQuery({
    queryKey: [...BLOQUES_KEY, jornadaId ?? '_all'],
    enabled: jornadaId === undefined || jornadaId !== null,
    queryFn: () => {
      const params = jornadaId ? `?jornada_id=${jornadaId}` : ''
      return api
        .get<{data: BloqueHorario[]}>(`/estructura/bloques-horarios${params}`)
        .then((res) => res.data)
    },
  })
}

export function useCreateBloqueHorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBloqueHorarioInput) =>
      api.post<{data: BloqueHorario}>('/estructura/bloques-horarios', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

export function useUpdateBloqueHorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateBloqueHorarioInput}) =>
      api.put<{data: BloqueHorario}>(`/estructura/bloques-horarios/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

export function useDeleteBloqueHorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/bloques-horarios/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: BLOQUES_KEY}),
  })
}

// ---- Espacios físicos ----

export function useEspaciosFisicos(sedeId?: string) {
  return useQuery({
    queryKey: [...ESPACIOS_KEY, sedeId ?? '_all'],
    enabled: sedeId === undefined || sedeId !== null,
    queryFn: () => {
      const params = sedeId ? `?sede_id=${sedeId}` : ''
      return api
        .get<{data: EspacioFisico[]}>(`/estructura/espacios-fisicos${params}`)
        .then((res) => res.data)
    },
  })
}

export function useCreateEspacioFisico() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEspacioFisicoInput) =>
      api.post<{data: EspacioFisico}>('/estructura/espacios-fisicos', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

export function useUpdateEspacioFisico() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: CreateEspacioFisicoInput}) =>
      api.put<{data: EspacioFisico}>(`/estructura/espacios-fisicos/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}

export function useDeleteEspacioFisico() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/estructura/espacios-fisicos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ESPACIOS_KEY}),
  })
}