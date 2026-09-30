import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAcademicYear} from '../academic-year-context'
import {fromOpaqueAcademic, toOpaqueAcademic} from '../shared/opaqueAcademic'

export type Named = {id: string; url_token: string; nombre: string}
export type ScheduleGroup = Named & {ano_lectivo_id: string; jornada_id: string | null; sede_id: string | null; grado: Named & {nivel_id: string; nivel?: Named}; sede: Named | null; jornada: (Named & {hora_inicio: string | null; hora_fin: string | null}) | null}
export type Assignment = {id: string; ano_lectivo_id: string; docente_id: string | null; materia_id: string; grupo_id: string; docente: {id: string; url_token: string; name: string} | null; materia: Named; grupo: ScheduleGroup}
export type Block = Named & {jornada_id: string; hora_inicio: string; hora_fin: string}
type SessionBase = {id: string; asignacion_id: string | null; grupo_id: string; materia_id: string; docente_id: string | null; grupo: ScheduleGroup; materia: Named; docente: {id: string; url_token: string; name: string} | null; dia: string; espacio_fisico_id: string | null; espacio: Named | null}
export type Session = SessionBase & (
  {bloque_horario_id: string; bloque: Block; hora_inicio: null; hora_fin: null} |
  {bloque_horario_id: null; bloque: null; hora_inicio: string; hora_fin: string}
)
export type SaveScheduleInput = {id?: string; grupo_id: string; materia_id: string; docente_id?: string | null; dia: string; espacio_fisico_id?: string | null; bloque_horario_id?: string | null; hora_inicio?: string | null; hora_fin?: string | null}
export type ScheduleData = {
  can_manage: boolean
  anos: (Named & {estado: string})[]
  grupos: ScheduleGroup[]
  docentes: {id: string; url_token: string; name: string}[]
  areas: Named[]
  materias: (Named & {estado: string; area_id: string | null; nivel_id: string | null; intensidad_horaria: number})[]
  bloques: Block[]
  espacios: (Named & {sede_id: string | null; estado?: string})[]
  asignaciones: Assignment[]
  pagination?: {asignaciones?: {current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null}}
  counts?: {materias?: number; sesiones?: number}
  sesiones: Session[]
}
type CatalogTokens = {group?: string; teacher?: string; room?: string}
export function useSchedule(view: 'resumen' | 'asignaciones' | 'horarios', enabled = true, tokens: CatalogTokens = {}) {
  const {yearToken} = useAcademicYear()
  return useQuery({queryKey: ['horarios', yearToken, view, tokens.group ?? '', tokens.teacher ?? '', tokens.room ?? ''], enabled: enabled && !!yearToken,
    queryFn: async () => {
      const params = new URLSearchParams({opaque: '1', ano_lectivo_token: yearToken})
      if (tokens.group) params.set('grupo_token', tokens.group)
      if (tokens.teacher) params.set('docente_token', tokens.teacher)
      if (tokens.room) params.set('selected_espacio_token', tokens.room)
      if (view === 'horarios') {
        params.set('vista', 'horarios')
      }
      return fromOpaqueAcademic<ScheduleData>((await api.get<{data: unknown}>(`/horarios?${params.toString()}`)).data)
    }})
}
import {useMutation, useQueryClient} from '@tanstack/react-query'

export function useAsignar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Pick<Assignment, 'ano_lectivo_id' | 'docente_id' | 'materia_id' | 'grupo_id'>) => await api.post('/asignaciones?opaque=1', toOpaqueAcademic(data)),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}

export function useDesasignar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => await api.delete(`/asignaciones/${encodeURIComponent(id)}?opaque=1`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}

export function useGuardarHorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: SaveScheduleInput) => {
      const {id, ...payload} = data
      if (id) return await api.put(`/horarios/${encodeURIComponent(id)}?opaque=1`, toOpaqueAcademic(payload))
      return await api.post('/horarios?opaque=1', toOpaqueAcademic(payload))
    },
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}

export function useEliminarHorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => await api.delete(`/horarios/${encodeURIComponent(id)}?opaque=1`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}
