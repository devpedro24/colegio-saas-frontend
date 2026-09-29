import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAcademicYear} from '../academic-year-context'

export type Named = {id: number; nombre: string}
export type ScheduleGroup = Named & {ano_lectivo_id: number; jornada_id: number | null; sede_id: number | null; grado: Named & {nivel_id: number; nivel?: Named}; sede: Named | null; jornada: (Named & {hora_inicio: string | null; hora_fin: string | null}) | null}
export type Assignment = {id: number; ano_lectivo_id: number; docente_id: number | null; materia_id: number; grupo_id: number; docente: {id: number; name: string} | null; materia: Named; grupo: ScheduleGroup}
export type Block = Named & {jornada_id: number; hora_inicio: string; hora_fin: string}
type SessionBase = {id: number; asignacion_id: number | null; grupo_id: number; materia_id: number; docente_id: number | null; grupo: ScheduleGroup; materia: Named; docente: {id: number; name: string} | null; dia: string; espacio_fisico_id: number | null; espacio: Named | null}
export type Session = SessionBase & (
  {bloque_horario_id: number; bloque: Block; hora_inicio: null; hora_fin: null} |
  {bloque_horario_id: null; bloque: null; hora_inicio: string; hora_fin: string}
)
export type SaveScheduleInput = {id?: number; grupo_id: number; materia_id: number; docente_id?: number | null; dia: string; espacio_fisico_id?: number | null; bloque_horario_id?: number | null; hora_inicio?: string | null; hora_fin?: string | null}
export type ScheduleData = {
  can_manage: boolean
  anos: (Named & {estado: string})[]
  grupos: ScheduleGroup[]
  docentes: {id: number; name: string}[]
  areas: Named[]
  materias: (Named & {estado: string; area_id: number | null; nivel_id: number | null; intensidad_horaria: number})[]
  bloques: Block[]
  espacios: (Named & {sede_id: number | null})[]
  asignaciones: Assignment[]
  sesiones: Session[]
}
export function useSchedule() {
  const {yearId} = useAcademicYear()
  return useQuery({queryKey: ['horarios', yearId], enabled: !!yearId,
    queryFn: async () => (await api.get<{data: ScheduleData}>(`/horarios?ano_lectivo_id=${yearId}`)).data})
}
import {useMutation, useQueryClient} from '@tanstack/react-query'

export function useAsignar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Pick<Assignment, 'ano_lectivo_id' | 'docente_id' | 'materia_id' | 'grupo_id'>) => await api.post('/asignaciones', data),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}

export function useDesasignar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => await api.delete(`/asignaciones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}

export function useGuardarHorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: SaveScheduleInput) => {
      if (data.id) return await api.put(`/horarios/${data.id}`, data)
      return await api.post('/horarios', data)
    },
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}

export function useEliminarHorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => await api.delete(`/horarios/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['horarios']}),
  })
}
