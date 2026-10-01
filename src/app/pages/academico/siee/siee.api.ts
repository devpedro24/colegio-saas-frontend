import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {AcademicPageMeta} from '@/app/shared/components/AcademicPagination'
import type {SieeResponse, SieeConfiguracion, CurriculoItem, SieeGrade, SieeSubject} from './siee.types'

const BASE_URL = '/siee'

async function everyPage<T>(path: string): Promise<T[]> {
  const rows: T[] = []
  let page = 1
  let last = 1
  do {
    const response = await api.get<{data: T[]; meta: AcademicPageMeta}>(`${path}${path.includes('?') ? '&' : '?'}per_page=1000&page=${page}`)
    rows.push(...response.data)
    last = response.meta.last_page
    page++
  } while (page <= last)
  return rows
}

export function useBulkCurriculumCatalog(yearToken: string) {
  return useQuery({queryKey: ['siee', 'bulk-catalog', yearToken], enabled: !!yearToken, queryFn: async () => {
    const params = new URLSearchParams({opaque: '1', ano_lectivo_token: yearToken})
    const [grades, subjects, curriculum] = await Promise.all([
      everyPage<SieeGrade>(`/catalogos-academicos?${params}&tipo=grados`),
      everyPage<SieeSubject>(`/catalogos-academicos?${params}&tipo=materias`),
      everyPage<CurriculoItem>(`${sieeYearPath(yearToken)}/curriculo`),
    ])
    return {grades: grades.filter(grade => grade.estado === 'activo'), subjects: subjects.filter(subject => subject.estado === 'activo'), curriculum}
  }})
}

export function useSaveBulkCurriculum(yearToken: string) {
  const client = useQueryClient()
  return useMutation({mutationFn: (items: Array<Pick<CurriculoItem, 'grado_token' | 'materia_token' | 'peso_area'>>) =>
    api.put<{data: {guardados: number}}>(`${sieeYearPath(yearToken)}/curriculo/masivo`, {items}),
  onSuccess: async () => {
    await Promise.all(['siee', 'academic-options', 'academic-options-all', 'horarios', 'evaluacion', 'boletines'].map(root => client.invalidateQueries({queryKey: [root]})))
  }})
}

// El año en la ruta SIEE se identifica únicamente por su selector público.
// Fallar aquí evita enviar accidentalmente un ID interno si cambia el caller.
const sieeYearPath = (yearToken: string) => {
  if (!/^[A-Za-z0-9_-]{24}$/.test(yearToken)) throw new Error('Selector público SIEE inválido')
  return `${BASE_URL}/${encodeURIComponent(yearToken)}`
}

export type ComponentePreparado = {
  nombre: string
  modo: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE'
  peso: string | null
  actividades: Array<{nombre: string; fecha: string; peso: string | null}>
}

export type PreparacionEvaluacion = {
  version: number
  componentes: ComponentePreparado[]
  bloqueos: string[]
  completa: boolean
  aplicada: boolean
  editable: boolean
}

export type PreparacionSeleccion = {grado_token: string; materia_token: string; periodo_token: string}

export function usePreparacionEvaluacion(yearToken: string, selected: PreparacionSeleccion | null) {
  return useQuery({
    queryKey: ['siee', 'preparacion', yearToken, selected],
    enabled: !!yearToken && !!selected,
    queryFn: () => api.get<{data: PreparacionEvaluacion}>(
      `${sieeYearPath(yearToken)}/preparacion?${new URLSearchParams(selected!)}`
    ).then((response) => response.data),
  })
}

export function useGuardarPreparacionEvaluacion(yearToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PreparacionSeleccion & {version: number; componentes: ComponentePreparado[]}) =>
      api.put<{data: PreparacionEvaluacion}>(`${sieeYearPath(yearToken)}/preparacion`, body).then(response => response.data),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['siee', 'preparacion', yearToken]}),
  })
}

export function useAplicarPreparacionEvaluacion(yearToken: string, assignmentToken: string, periodToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`${sieeYearPath(yearToken)}/preparacion/aplicar`, {
      asignacion_token: assignmentToken, periodo_token: periodToken,
    }),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ['evaluacion', 'planillas', assignmentToken, periodToken]}),
  })
}

export const useSiee = (yearToken: string) => {
  return useQuery<SieeResponse>({
    queryKey: ['siee', yearToken],
    queryFn: () => api.get<{data: SieeResponse}>(sieeYearPath(yearToken)).then((res) => res.data),
    enabled: !!yearToken,
  })
}

export type CurriculoFilters = {
  page: number
  perPage: number
  search: string
  gradoToken: string
  materiaToken: string
  areaToken: string
}

export const useCurriculo = (yearToken: string, filters: CurriculoFilters) => useQuery({
  queryKey: ['siee', 'curriculo', yearToken, filters],
  queryFn: () => {
    const params = new URLSearchParams({page: String(filters.page), per_page: String(filters.perPage)})
    if (filters.search) params.set('search', filters.search)
    if (filters.gradoToken) params.set('grado_token', filters.gradoToken)
    if (filters.materiaToken) params.set('materia_token', filters.materiaToken)
    if (filters.areaToken) params.set('area_token', filters.areaToken)
    return api.get<{data: CurriculoItem[]; meta: AcademicPageMeta}>(
      `${sieeYearPath(yearToken)}/curriculo?${params}`
    )
  },
  enabled: !!yearToken,
})

export const useUpdateSiee = (yearToken: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SieeConfiguracion) =>
      api.put<{data: SieeResponse}>(sieeYearPath(yearToken), data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['siee', yearToken]})
      queryClient.invalidateQueries({queryKey: ['siee', 'curriculo', yearToken]})
      queryClient.invalidateQueries({queryKey: ['siee', 'bulk-catalog', yearToken]})
    },
  })
}

export const useUpdateCurriculo = (yearToken: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      grado_token: string
      materia_token: string
      area_token: string | null
      peso_area: string | null
    }) =>
      api
        .put<{data: SieeResponse}>(`${sieeYearPath(yearToken)}/curriculo`, data)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['siee', yearToken]})
      queryClient.invalidateQueries({queryKey: ['siee', 'curriculo', yearToken]})
      queryClient.invalidateQueries({queryKey: ['siee', 'bulk-catalog', yearToken]})
    },
  })
}
