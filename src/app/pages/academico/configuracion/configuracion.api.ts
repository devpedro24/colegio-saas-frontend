// Capa de datos del feature Configuracion del colegio: funciones sobre el api client
// + hooks de TanStack Query. Rutas tenant bajo /api. La escala, el metodo de aprobacion
// y el modelo pedagogico se consultan filtrados por ?ano_lectivo_token=.

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
export function useDatosInstitucionales(enabled = true) {
  return useQuery({
    queryKey: DATOS_INSTITUCIONALES_KEY,
    enabled,
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

export const escalasKey = (anoLectivoToken: string) => ['config', 'escalas', anoLectivoToken] as const

/** GET /config/escalas?ano_lectivo_token= — escalas del ano lectivo. */
export function useEscalas(anoLectivoToken: string | null) {
  return useQuery({
    queryKey: escalasKey(anoLectivoToken ?? '_'),
    enabled: !!anoLectivoToken,
    queryFn: () =>
      api
        .get<{data: EscalaValorativa[]}>(`/config/escalas?opaque=1&ano_lectivo_token=${anoLectivoToken}`),
  })
}

/** POST /config/escalas — crea una escala. */
export function useCreateEscala(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EscalaValorativaInput) =>
      api.post<{data: EscalaValorativa}>('/config/escalas?opaque=1', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: escalasKey(anoLectivoToken)}),
  })
}

/** PUT /config/escalas/{id} — actualiza una escala. */
export function useUpdateEscala(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: EscalaValorativaInput}) =>
      api.put<{data: EscalaValorativa}>(`/config/escalas/${id}?opaque=1`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: escalasKey(anoLectivoToken)}),
  })
}

/** DELETE /config/escalas/{id} — elimina una escala. */
export function useDeleteEscala(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/config/escalas/${id}?opaque=1`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: escalasKey(anoLectivoToken)}),
  })
}

// ------------------------------ Metodo de aprobacion ------------------------------

export const metodosKey = (anoLectivoToken: string) =>
  ['config', 'metodos-aprobacion', anoLectivoToken] as const

/** GET /config/metodos-aprobacion?ano_lectivo_token= — metodos del ano lectivo. */
export function useMetodosAprobacion(anoLectivoToken: string | null) {
  return useQuery({
    queryKey: metodosKey(anoLectivoToken ?? '_'),
    enabled: !!anoLectivoToken,
    queryFn: () =>
      api
        .get<{data: MetodoAprobacion[]}>(
          `/config/metodos-aprobacion?opaque=1&ano_lectivo_token=${anoLectivoToken}`
        ),
  })
}

/** POST /config/metodos-aprobacion — crea un metodo de aprobacion. */
export function useCreateMetodo(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MetodoAprobacionInput) =>
      api.post<{data: MetodoAprobacion}>('/config/metodos-aprobacion?opaque=1', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: metodosKey(anoLectivoToken)}),
  })
}

/** PUT /config/metodos-aprobacion/{id} — actualiza un metodo de aprobacion. */
export function useUpdateMetodo(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: MetodoAprobacionInput}) =>
      api.put<{data: MetodoAprobacion}>(`/config/metodos-aprobacion/${id}?opaque=1`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: metodosKey(anoLectivoToken)}),
  })
}

/** DELETE /config/metodos-aprobacion/{id} — elimina un metodo de aprobacion. */
export function useDeleteMetodo(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/config/metodos-aprobacion/${id}?opaque=1`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: metodosKey(anoLectivoToken)}),
  })
}

// ------------------------------ Modelo pedagogico ------------------------------

export const modelosKey = (anoLectivoToken: string) =>
  ['config', 'modelos-pedagogicos', anoLectivoToken] as const

/** GET /config/modelos-pedagogicos?ano_lectivo_token= — modelos del ano lectivo. */
export function useModelosPedagogicos(anoLectivoToken: string | null) {
  return useQuery({
    queryKey: modelosKey(anoLectivoToken ?? '_'),
    enabled: !!anoLectivoToken,
    queryFn: () =>
      api
        .get<{data: ModeloPedagogico[]}>(
          `/config/modelos-pedagogicos?opaque=1&ano_lectivo_token=${anoLectivoToken}`
        ),
  })
}

/** POST /config/modelos-pedagogicos — crea un modelo pedagogico. */
export function useCreateModelo(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ModeloPedagogicoInput) =>
      api.post<{data: ModeloPedagogico}>('/config/modelos-pedagogicos?opaque=1', input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: modelosKey(anoLectivoToken)}),
  })
}

/** PUT /config/modelos-pedagogicos/{id} — actualiza un modelo pedagogico. */
export function useUpdateModelo(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({id, input}: {id: string; input: ModeloPedagogicoInput}) =>
      api.put<{data: ModeloPedagogico}>(`/config/modelos-pedagogicos/${id}?opaque=1`, input),
    onSuccess: () => queryClient.invalidateQueries({queryKey: modelosKey(anoLectivoToken)}),
  })
}

/** DELETE /config/modelos-pedagogicos/{id} — elimina un modelo pedagogico. */
export function useDeleteModelo(anoLectivoToken: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{data: null}>(`/config/modelos-pedagogicos/${id}?opaque=1`),
    onSuccess: () => queryClient.invalidateQueries({queryKey: modelosKey(anoLectivoToken)}),
  })
}
