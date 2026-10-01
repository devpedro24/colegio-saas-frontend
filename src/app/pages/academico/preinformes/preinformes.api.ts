import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

export type Preinforme = {url_token?: string | null; nombre: string; peso: string | null; fecha_inicio: string | null; fecha_fin: string | null}
export type PeriodoPreinformes = {
  url_token: string; nombre: string; estado: string; fecha_inicio: string; fecha_fin: string; version: number; editable: boolean
  configuracion: {usar_preinformes: boolean; modo: 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE'; fechas_estrictas: boolean}
  preinformes: Preinforme[]
}
type Configuracion = {
  anos: {url_token: string; nombre: string; estado: string}[]
  ano: {url_token: string; nombre: string; estado: string} | null
  incluido_plan: boolean; puede_gestionar: boolean; periodos: PeriodoPreinformes[]
}
export function usePreinformes(year: string) {
  return useQuery({queryKey: ['preinformes', year], queryFn: () => api.get<{data: Configuracion}>(`/preinformes${year ? `?ano_lectivo_token=${encodeURIComponent(year)}` : ''}`).then(r => r.data)})
}
export function useGuardarPreinformes() {
  const cache = useQueryClient()
  return useMutation({mutationFn: (period: PeriodoPreinformes) => api.put(`/preinformes/${period.url_token}`, {
    version: period.version, ...period.configuracion, preinformes: period.preinformes,
  }), onSuccess: () => {
    cache.invalidateQueries({queryKey: ['preinformes']})
    cache.invalidateQueries({queryKey: ['evaluacion']})
  }})
}
