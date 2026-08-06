// Capa de datos del feature Configuracion del colegio: funciones sobre el api client
// + hooks de TanStack Query. Rutas tenant bajo /api. La escala, el metodo de aprobacion
// y el modelo pedagogico se consultan filtrados por ?ano_lectivo_id=.

import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import type {
  DatosInstitucionales,
  DatosInstitucionalesInput,
  EscalaValorativa,
  EscalaValorativaInput,
  MetodoAprobacion,
  MetodoAprobacionInput,
  ModeloPedagogico,
  ModeloPedagogicoInput,
} from './configuracion.types'

// ------------------------------ Datos institucionales ------------------------------

export const DATOS_INSTITUCIONALES_KEY = ['config', 'datos-institucionales'] as const

/** GET /config/datos-institucionales — datos institucionales del colegio. */
export function useDatosInstitucionales() {
  return useQuery({
    queryKey: DATOS_INSTITUCIONALES_KEY,
    queryFn: () =>
      api
        .get<{data: DatosInstitucionales}>('/config/datos-institucionales'),
  })
}

/** PUT /config/datos-institucionales — actualiza los datos institucionales. */
export function useUpdateDatosInstitucionales() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DatosInstitucionalesInput) =>
      api.put<{data: DatosInstitucionales}>('/config/datos-institucionales', input),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: DATOS_INSTITUCIONALES_KEY})
    },
  })
}

// ------------------------------ Escala valorativa ------------------------------

export const escalasKey = (anoLectivoId: string) => ['config', 'escalas', anoLectivoId] as const

/** GET /config/escalas?ano_lectivo_id= — escalas del ano lectivo. */
export function useEscalas(anoLectivoId: string | null) {
  return useQuery({
    queryKey: escalasKey(anoLectivoId ?? '_'),
    enabled: !!anoLectivoId,
    queryFn: () =>
      api
        .get<{data: EscalaValorativa[]}>(`/config/escalas?ano_lectivo_id=${anoLectivoId}`),
  })
}

/** POST /config/escalas — crea una escala. */
export function useCreateEscala(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EscalaValorativaInput) =>
      api.post<{data: EscalaValorativa}>('/config/escalas', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: escalasKey(anoLectivoId)}),
  })
}

/** PUT /config/escalas/{id} — actualiza una escala. */
export function useUpdateEscala(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: EscalaValorativaInput}) =>
      api.put<{data: EscalaValorativa}>(`/config/escalas/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: escalasKey(anoLectivoId)}),
  })
}

/** DELETE /config/escalas/{id} — elimina una escala. */
export function useDeleteEscala(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/config/escalas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: escalasKey(anoLectivoId)}),
  })
}

// ------------------------------ Metodo de aprobacion ------------------------------

export const metodosKey = (anoLectivoId: string) =>
  ['config', 'metodos-aprobacion', anoLectivoId] as const

/** GET /config/metodos-aprobacion?ano_lectivo_id= — metodos del ano lectivo. */
export function useMetodosAprobacion(anoLectivoId: string | null) {
  return useQuery({
    queryKey: metodosKey(anoLectivoId ?? '_'),
    enabled: !!anoLectivoId,
    queryFn: () =>
      api
        .get<{data: MetodoAprobacion[]}>(
          `/config/metodos-aprobacion?ano_lectivo_id=${anoLectivoId}`
        ),
  })
}

/** POST /config/metodos-aprobacion — crea un metodo de aprobacion. */
export function useCreateMetodo(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MetodoAprobacionInput) =>
      api.post<{data: MetodoAprobacion}>('/config/metodos-aprobacion', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: metodosKey(anoLectivoId)}),
  })
}

/** PUT /config/metodos-aprobacion/{id} — actualiza un metodo de aprobacion. */
export function useUpdateMetodo(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: MetodoAprobacionInput}) =>
      api.put<{data: MetodoAprobacion}>(`/config/metodos-aprobacion/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: metodosKey(anoLectivoId)}),
  })
}

/** DELETE /config/metodos-aprobacion/{id} — elimina un metodo de aprobacion. */
export function useDeleteMetodo(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/config/metodos-aprobacion/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: metodosKey(anoLectivoId)}),
  })
}

// ------------------------------ Modelo pedagogico ------------------------------

export const modelosKey = (anoLectivoId: string) =>
  ['config', 'modelos-pedagogicos', anoLectivoId] as const

/** GET /config/modelos-pedagogicos?ano_lectivo_id= — modelos del ano lectivo. */
export function useModelosPedagogicos(anoLectivoId: string | null) {
  return useQuery({
    queryKey: modelosKey(anoLectivoId ?? '_'),
    enabled: !!anoLectivoId,
    queryFn: () =>
      api
        .get<{data: ModeloPedagogico[]}>(
          `/config/modelos-pedagogicos?ano_lectivo_id=${anoLectivoId}`
        ),
  })
}

/** POST /config/modelos-pedagogicos — crea un modelo pedagogico. */
export function useCreateModelo(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ModeloPedagogicoInput) =>
      api.post<{data: ModeloPedagogico}>('/config/modelos-pedagogicos', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: modelosKey(anoLectivoId)}),
  })
}

/** PUT /config/modelos-pedagogicos/{id} — actualiza un modelo pedagogico. */
export function useUpdateModelo(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: ModeloPedagogicoInput}) =>
      api.put<{data: ModeloPedagogico}>(`/config/modelos-pedagogicos/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: modelosKey(anoLectivoId)}),
  })
}

/** DELETE /config/modelos-pedagogicos/{id} — elimina un modelo pedagogico. */
export function useDeleteModelo(anoLectivoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/config/modelos-pedagogicos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: modelosKey(anoLectivoId)}),
  })
}
