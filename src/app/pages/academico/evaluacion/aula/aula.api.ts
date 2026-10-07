import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {shouldRefreshQuery} from '@/lib/realtime'

export type AulaCard = {aula_token: string; grupo_token: string; grupo: string; materia_token: string;
  materia: string; docente: string; portada_token: string | null;
  progreso?: {completados: number; total: number; porcentaje: number}}
type AulaCatalogoData = {anos: {token: string; nombre: string; estado: string}[];
  ano_token: string | null; grupos: {token: string; nombre: string; grado: string; etiqueta: string}[];
  grupo_seleccionado: string | null; requiere_grupo: boolean; aulas: AulaCard[]; puede_gestionar: boolean;
  puede_configurar: boolean}
export type AulaScale = {tipo: 'numerica' | 'imagenes'; nombre?: string; opciones: {
  url_token: string; nombre: string; emoji: string | null; imagen_url: string | null}[]}
export type AulaResource = {token: string; tipo: 'texto' | 'archivo' | 'tarea' | 'cuestionario'; titulo: string;
  eliminado?: boolean;
  no_disponible?: 'programado';
  contenido: {bloques: {tipo: string; texto?: string; url?: string}[]; html?: string | null}; estado: string; visible_estudiantes: boolean;
  aula_token?: string; seccion_token?: string;
  calificable: boolean; llevar_planilla: boolean; actividad_token: string | null; peso: string | null;
  estado_vinculo_planilla?: 'no_solicitado' | 'vinculado' | 'pendiente_apertura' | 'pendiente_configuracion';
  disponible_desde: string | null; disponible_hasta: string | null; fecha_limite: string | null;
  zona_publicacion: string | null; version: number; configuracion?: Record<string, unknown>;
  preguntas?: Question[]; cantidad_preguntas?: number; tiene_intentos?: boolean; adjuntos?: AulaAttachment[];
  escala?: AulaScale; requiere_motivo?: boolean; puede_interactuar?: boolean;
  progreso?: 'sin_iniciar' | 'pendiente' | 'completado';
  completar_al?: 'abrir' | 'entregar' | 'revisar' | 'finalizar';
  reenvios?: boolean;
  estudiante?: boolean; puede_gestionar?: boolean; puede_calificar?: boolean; puede_evaluar?: boolean;
  puede_adjuntar?: boolean; puede_planilla?: boolean; puede_calificar_cuestionario?: boolean; puede_reactivar_intento?: boolean;
  entrega?: {token: string; texto: string; estado: string; nota: string | null;
    valoracion?: {nombre: string; emoji: string | null; imagen_url: string | null} | null; retroalimentacion: string | null;
    adjuntos: {token: string; nombre: string}[]} | null}
export type QuestionMedia = {token: string; nombre: string; mime: string; opcion_indice: number | null}
export type Question = {token: string; tipo: string; enunciado: string; opciones: string[] | null; puntos: string;
  respuestas_disponibles?: string[];
  respuesta_correcta?: {valor: string | string[]}; puntajes_opciones?: Record<string, string> | null;
  rubrica?: {nombre: string; puntos: string}[] | null; medios?: QuestionMedia[]}
export type AulaAttachment = {token: string; nombre: string; mime?: string | null; es_imagen?: boolean}
export type AulaSection = {token: string; titulo: string; periodo: string; periodo_token: string; preinforme_token: string | null;
  visible_estudiantes: boolean; orden: number; eliminado?: boolean; recursos: AulaResource[]}
export type AulaDetail = {token: string; grado: string; grupo: string; materia: string; portada_token: string | null; estudiante: boolean;
  limite_archivo_bytes: number; puede_gestionar: boolean; puede_restaurar?: boolean;
  permitir_edicion_periodos_cerrados: boolean;
  colores_periodos: Record<string, string>; color_preinforme: string;
  permisos: {crear: boolean; editar: boolean; publicar: boolean; archivar: boolean; eliminar: boolean; archivos: boolean; planilla: boolean;
    evaluaciones: boolean};
  periodos: {token: string; nombre: string; orden: number; estado: string;
    preinformes: {token: string; nombre: string}[]}[]; secciones: AulaSection[]}
export type ResourceInput = {tipo: AulaResource['tipo']; titulo: string; seccion_token?: string;
  contenido: {bloques: {tipo: string; texto?: string; url?: string}[]; html?: string | null};
  estado: string; visible_estudiantes: boolean; calificable: boolean; llevar_planilla: boolean;
  peso?: string | null; disponible_desde?: string | null; disponible_hasta?: string | null;
  configuracion?: Record<string, unknown>; version?: number}
export type PlanillaDestino = {grupo: string; asignatura: string; periodo: string; estado_periodo: string;
  preinforme: string | null; requiere_preinforme: boolean;
  componentes: {token: string; nombre: string; modo: string; peso_utilizado: string}[]}
export type AulaSubmission = {token: string; estudiante: string; texto: string; estado: string; nota: string | null;
  escala_opcion_token: string | null; retroalimentacion: string | null; version: number;
  adjuntos: {token: string; nombre: string}[]}
export type Attempt = {token: string; version: number; estado: string; vence_at: string; numero: number; incidentes: number;
  vigilado: boolean; incidentes_permitidos: number; duracion_minima_minutos: number;
  respuestas: Record<string, string | string[]>; preguntas: Question[];
  revision_preguntas?: Record<string, {puntos: string; retroalimentacion: string | null; criterios: string[]}>;
  nota: string | null; valoracion?: {nombre: string; emoji: string | null} | null;
  pagina_actual: number; preguntas_por_pagina: number; preguntas_total: number;
  permitir_regresar: boolean; permitir_editar_respuestas: boolean}

const base = '/aula'
export type AulaConfiguration = {permitir_edicion_periodos_cerrados: boolean;
  colores_periodos: Record<string, string>; color_preinforme: string;
  puede_configurar_colores: boolean; periodos_configurables: {orden: number; nombre: string}[]}
export const useAulaConfiguration = (enabled: boolean) => useQuery({
  queryKey: ['aula', 'configuracion'], enabled, staleTime: 5 * 60_000,
  queryFn: () => api.get<{data: AulaConfiguration}>(`${base}/configuracion`).then(response => response.data),
})
export const useGuardarAulaConfiguration = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: Pick<AulaConfiguration, 'permitir_edicion_periodos_cerrados'> &
    Partial<Pick<AulaConfiguration, 'colores_periodos' | 'color_preinforme'>>) =>
    api.put<{data: Partial<AulaConfiguration>}>(`${base}/configuracion`, input).then(response => response.data),
  onSuccess: data => {
    client.setQueryData<AulaConfiguration>(['aula', 'configuracion'], current => current ? {...current, ...data} : current)
    void client.invalidateQueries({predicate: query => query.queryKey[0] === 'aula' && query.queryKey.length === 2
      && query.queryKey[1] !== 'configuracion' && query.queryKey[1] !== 'catalogo'})
  },
})}
const refetchAula = (client: ReturnType<typeof useQueryClient>, affectsGradebook = false) => {
  void client.invalidateQueries({queryKey: ['aula']})
  if (affectsGradebook) void client.invalidateQueries({queryKey: ['evaluacion', 'planillas']})
}
const refetchAulaContent = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({predicate: query => shouldRefreshQuery(query.queryKey, ['aula-content'], 'tenant')})
}
const aulaDetails = (query: {queryKey: readonly unknown[]}) => query.queryKey[0] === 'aula'
  && query.queryKey.length === 2 && query.queryKey[1] !== 'catalogo'
const detailsContainingResource = (query: {queryKey: readonly unknown[]; state: {data?: unknown}}, token: string) =>
  aulaDetails(query) && (query.state.data as AulaDetail | undefined)?.secciones.some(section =>
    section.recursos.some(resource => resource.token === token)) === true
const updateCachedResource = (client: ReturnType<typeof useQueryClient>, token: string,
  update: (resource: AulaResource) => AulaResource) => {
  client.setQueryData<AulaResource>(['aula', 'recurso', token], current => current ? update(current) : current)
  client.setQueriesData<AulaDetail>({predicate: query => detailsContainingResource(query, token)}, current => {
    if (!current) return current
    let changed = false
    const secciones = current.secciones.map(section => ({...section, recursos: section.recursos.map(resource => {
      if (resource.token !== token) return resource
      changed = true
      return update(resource)
    })}))
    return changed ? {...current, secciones} : current
  })
}
const removeCachedAttachment = (client: ReturnType<typeof useQueryClient>, token: string) => {
  const remove = <T extends {token: string}>(files: T[]): T[] => files.filter(file => file.token !== token)
  const update = (resource: AulaResource): AulaResource => {
    const inResource = resource.adjuntos?.some(file => file.token === token) ?? false
    const inSubmission = resource.entrega?.adjuntos.some(file => file.token === token) ?? false
    if (!inResource && !inSubmission) return resource
    return {...resource,
      adjuntos: inResource && resource.adjuntos ? remove(resource.adjuntos) : resource.adjuntos,
      entrega: inSubmission && resource.entrega
        ? {...resource.entrega, adjuntos: remove(resource.entrega.adjuntos)} : resource.entrega}
  }
  const containsAttachment = (resource: AulaResource | undefined) => (resource?.adjuntos?.some(file => file.token === token) ?? false)
    || (resource?.entrega?.adjuntos.some(file => file.token === token) ?? false)
  client.setQueriesData<AulaResource>({predicate: query => query.queryKey[0] === 'aula' && query.queryKey[1] === 'recurso'
    && containsAttachment(query.state.data as AulaResource | undefined)}, current => current ? update(current) : current)
  client.setQueriesData<AulaDetail>({predicate: query => aulaDetails(query)
    && (query.state.data as AulaDetail | undefined)?.secciones.some(section => section.recursos.some(containsAttachment)) === true}, current => {
    if (!current) return current
    const secciones = current.secciones.map(section => {
      const recursos = section.recursos.map(update)
      return recursos.some((item, index) => item !== section.recursos[index]) ? {...section, recursos} : section
    })
    return secciones.some((item, index) => item !== current.secciones[index]) ? {...current, secciones} : current
  })
  client.setQueriesData<AulaSubmission[]>({predicate: query => query.queryKey[0] === 'aula' && query.queryKey[1] === 'entregas'
    && (query.state.data as AulaSubmission[] | undefined)?.some(item => item.adjuntos.some(file => file.token === token)) === true}, current => {
    if (!current) return current
    const submissions = current.map(item => item.adjuntos.some(file => file.token === token)
      ? {...item, adjuntos: remove(item.adjuntos)} : item)
    return submissions.some((item, index) => item !== current[index]) ? submissions : current
  })
}
export const useAulaCatalogo = (year: string, group: string) => {
  const client = useQueryClient()
  const initialKey = ['aula', 'catalogo', '', '']
  const initial = !group && year ? client.getQueryData<AulaCatalogoData>(initialKey) : undefined
  const reuseInitial = initial?.ano_token === year
  return useQuery({queryKey: ['aula', 'catalogo', year, group], staleTime: 5 * 60_000,
    initialData: reuseInitial ? initial : undefined,
    initialDataUpdatedAt: reuseInitial ? client.getQueryState(initialKey)?.dataUpdatedAt : undefined,
    queryFn: () => api.get<{data: AulaCatalogoData}>(`${base}/catalogo?opaque=1${year ? `&ano_token=${encodeURIComponent(year)}` : ''}${group ? `&grupo_token=${encodeURIComponent(group)}` : ''}`)
      .then(response => response.data)})
}
export const useAula = (token: string) => useQuery({queryKey: ['aula', token], enabled: !!token,
  staleTime: 2 * 60_000,
  queryFn: () => api.get<{data: AulaDetail}>(`${base}/${encodeURIComponent(token)}?opaque=1`).then(response => response.data)})
export const useAulaRecurso = (token: string) => useQuery({queryKey: ['aula', 'recurso', token], enabled: !!token,
  staleTime: 2 * 60_000,
  queryFn: () => api.get<{data: AulaResource}>(`${base}/recursos/${encodeURIComponent(token)}?opaque=1`).then(response => response.data)})
export const usePlanillaDestino = (section: string, enabled: boolean) => useQuery({
  queryKey: ['aula', 'planilla-destino', section], enabled: !!section && enabled, staleTime: 30_000,
  queryFn: () => api.get<{data: PlanillaDestino}>(`${base}/secciones/${encodeURIComponent(section)}/planilla?opaque=1`).then(r => r.data),
})
export const useAbrirRecurso = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.post<{data: {progreso: AulaResource['progreso']; aula_token: string;
    resumen: NonNullable<AulaCard['progreso']>}}>(`${base}/recursos/${encodeURIComponent(token)}/abrir?opaque=1`, {}).then(r => r.data),
  onSuccess: (result, token) => {
    client.setQueryData<AulaResource>(['aula', 'recurso', token], current => current ? {...current, progreso: result.progreso} : current)
    client.setQueryData<AulaDetail>(['aula', result.aula_token], current => current ? {...current,
      secciones: current.secciones.map(section => ({...section,
        recursos: section.recursos.map(resource => resource.token === token ? {...resource, progreso: result.progreso} : resource)}))} : current)
    client.setQueriesData<AulaCatalogoData>({queryKey: ['aula', 'catalogo']}, current => current ? {...current,
      aulas: current.aulas.map(aula => aula.aula_token === result.aula_token ? {...aula, progreso: result.resumen} : aula)} : current)
  },
})}
export const useCrearSeccion = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {aula: string; periodo_token: string; preinforme_token: string | null; titulo: string;
    visible_estudiantes: boolean}) =>
    api.post(`${base}/${input.aula}/secciones?opaque=1`, input), onSuccess: () => refetchAula(client),
})}
export const useEditarSeccion = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; titulo?: string; periodo_token?: string; preinforme_token?: string | null; visible_estudiantes?: boolean}) =>
    api.put(`${base}/secciones/${input.token}?opaque=1`, input), onSuccess: () => refetchAula(client),
})}
export const useEliminarSeccion = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.delete(`${base}/secciones/${token}?opaque=1`), onSuccess: () => refetchAula(client),
})}
export const useRestaurarSeccion = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.post(`${base}/secciones/${token}/restaurar?opaque=1`, {}), onSuccess: () => refetchAula(client),
})}
export const useEliminarRecurso = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.delete(`${base}/recursos/${token}?opaque=1`), onSuccess: () => refetchAula(client, true),
})}
export const useRestaurarRecurso = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.post(`${base}/recursos/${token}/restaurar?opaque=1`, {}), onSuccess: () => refetchAula(client, true),
})}
export const useGuardarRecurso = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {section: string; token?: string; data: ResourceInput}) => input.token
    ? api.put<{data: AulaResource}>(`${base}/recursos/${input.token}?opaque=1`, input.data, {notifyLocalChange: false})
    : api.post<{data: {token: string}}>(`${base}/secciones/${input.section}/recursos?opaque=1`, input.data),
  onSuccess: (result, input) => {
    if (!input.token) {refetchAula(client, true); return}
    const token = input.token
    const updated = result.data as AulaResource
    client.setQueryData<AulaResource>(['aula', 'recurso', token], current => current ? {...current, ...updated,
      seccion_token: input.data.seccion_token ?? current.seccion_token} : current)
    client.setQueriesData<AulaDetail>({predicate: query => detailsContainingResource(query, token)}, current => {
      if (!current) return current
      const source = current.secciones.find(section => section.recursos.some(resource => resource.token === token))
      const previous = source?.recursos.find(resource => resource.token === token)
      if (!previous) return current
      const destination = input.data.seccion_token ?? input.section
      return {...current, secciones: current.secciones.map(section => {
        if (section.token === destination && section.token === source?.token) return {...section,
          recursos: section.recursos.map(resource => resource.token === token
            ? {...resource, ...updated, seccion_token: destination} : resource)}
        return {...section, recursos: [...section.recursos.filter(resource => resource.token !== token),
          ...(section.token === destination ? [{...previous, ...updated, seccion_token: destination}] : [])]}
      })}
    })
    void client.invalidateQueries({queryKey: ['aula', 'catalogo'], refetchType: 'none'})
    void client.invalidateQueries({queryKey: ['evaluacion', 'planillas'], refetchType: 'none'})
  },
})}
export const useVincularPlanilla = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.post(`${base}/recursos/${encodeURIComponent(token)}/vincular-planilla?opaque=1`, {}),
  onSuccess: () => refetchAula(client, true),
})}
export const useArchivarRecurso = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number}) =>
    api.post(`${base}/recursos/${input.token}/archivar?opaque=1`, {version: input.version}),
  onSuccess: () => refetchAula(client),
})}
export const useEntregarTarea = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; texto: string}) => api.post(`${base}/recursos/${input.token}/entregas?opaque=1`, {texto: input.texto}),
  onSuccess: () => refetchAula(client),
})}
export const useBorradorEntrega = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.post<{data: {token: string}}>(`${base}/recursos/${token}/entregas/borrador?opaque=1`, {})
    .then(r => r.data), onSuccess: () => refetchAula(client),
})}
export const useEntregas = (token: string, enabled: boolean) => useQuery({queryKey: ['aula', 'entregas', token], enabled: !!token && enabled,
  queryFn: () => api.get<{data: AulaSubmission[]}>(`${base}/recursos/${token}/entregas?opaque=1`).then(r => r.data)})
export const useSubirAdjunto = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; archivo: File; destino: 'recursos' | 'entregas'}) => {
    const data = new FormData(); data.append('archivo', input.archivo)
    return api.post<{data: AulaAttachment}>(`${base}/${input.destino}/${input.token}/adjuntos?opaque=1`, data,
      input.destino === 'recursos' ? {notifyLocalChange: false} : undefined)
  }, onSuccess: (result, input) => {
    if (input.destino !== 'recursos') {refetchAulaContent(client); return}
    updateCachedResource(client, input.token, resource => ({...resource,
      adjuntos: [...(resource.adjuntos ?? []).filter(file => file.token !== result.data.token), result.data]}))
  },
})}
export const useQuitarAdjunto = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.delete(`${base}/adjuntos/${encodeURIComponent(token)}?opaque=1`,
    {notifyLocalChange: false}),
  onSuccess: (_result, token) => removeCachedAttachment(client, token),
})}
export const useSubirPortadaAula = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; archivo: File}) => {
    const data = new FormData(); data.append('archivo', input.archivo)
    return api.post(`${base}/${input.token}/portada?opaque=1`, data)
  }, onSuccess: () => refetchAula(client),
})}
export const aulaPortadaUrl = (token: string) => `/api/aula/${encodeURIComponent(token)}/portada?opaque=1`
export const aulaAdjuntoUrl = (token: string) => `/api/aula/adjuntos/${encodeURIComponent(token)}?opaque=1`
export const aulaImagenUrl = (token: string) => `/api/aula/adjuntos/${encodeURIComponent(token)}/imagen?opaque=1`
export const aulaMedioUrl = (token: string) => `/api/aula/adjuntos/${encodeURIComponent(token)}/medio?opaque=1`
export const aulaOficinaUrl = (token: string) => `/api/aula/adjuntos/${encodeURIComponent(token)}/vista-oficina?opaque=1`
export const useCalificarEntrega = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number; nota?: string; escala_opcion_token?: string;
    retroalimentacion: string; motivo?: string}) =>
    api.put(`${base}/entregas/${input.token}/calificar?opaque=1`, input), onSuccess: () => refetchAula(client, true),
})}
export const useRevisarEntrega = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number; retroalimentacion: string}) =>
    api.put(`${base}/entregas/${input.token}/revisar?opaque=1`, input), onSuccess: () => refetchAula(client),
})}
export const useGuardarPreguntas = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number; preguntas: {token?: string; tipo: string; enunciado: string; opciones: string[];
    respuesta_correcta: {valor: string | string[]} | null; puntos: string;
    puntajes_opciones?: Record<string, string> | null; rubrica?: {nombre: string; puntos: string}[] | null}[]}) =>
    api.put<{data: {guardado: boolean; version: number; preguntas: Question[]}}>(`${base}/recursos/${input.token}/preguntas?opaque=1`,
      {version: input.version, preguntas: input.preguntas}).then(r => r.data),
  onSuccess: () => refetchAula(client),
})}
export const aulaPreguntaMedioUrl = (token: string) => `/api/aula/preguntas/medios/${encodeURIComponent(token)}?opaque=1`
export const aulaRespuestaMedioUrl = (token: string) => `/api/aula/respuestas/medios/${encodeURIComponent(token)}?opaque=1`
export const useSubirMedioPregunta = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {pregunta: string; archivo: File; opcion_indice?: number | null}) => {
    const data = new FormData(); data.append('archivo', input.archivo)
    if (input.opcion_indice !== undefined && input.opcion_indice !== null) data.append('opcion_indice', String(input.opcion_indice))
    return api.post<{data: QuestionMedia}>(`${base}/preguntas/${input.pregunta}/medios?opaque=1`, data).then(r => r.data)
  }, onSuccess: () => refetchAula(client),
})}
export const useQuitarMedioPregunta = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.delete(`${base}/preguntas/medios/${encodeURIComponent(token)}?opaque=1`),
  onSuccess: () => refetchAula(client),
})}
export const useSubirRespuestaMedio = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {intento: string; pregunta: string; archivo: File}) => {
    const data = new FormData(); data.append('archivo', input.archivo)
    return api.post<{data: {token: string; nombre: string; mime: string}}>(
      `${base}/intentos/${input.intento}/preguntas/${input.pregunta}/respuesta-medio?opaque=1`, data).then(r => r.data)
  }, onSuccess: () => refetchAula(client),
})}
export const useRevisarPreguntas = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number; motivo: string; evaluaciones: {
    pregunta_token: string; puntos: string; retroalimentacion: string; criterios: string[]}[]}) =>
    api.put(`${base}/intentos/${input.token}/revisar-preguntas?opaque=1`, input),
  onSuccess: () => refetchAula(client, true),
})}
export const useIniciarIntento = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.post<{data: Attempt}>(`${base}/recursos/${token}/intentos?opaque=1`, {}).then(r => r.data),
  onSuccess: () => refetchAula(client),
})}
export const useIntento = (token: string) => useQuery({queryKey: ['aula', 'intento', token], enabled: !!token,
  queryFn: () => api.get<{data: Attempt}>(`${base}/intentos/${token}?opaque=1`).then(r => r.data)})
export const useMiIntento = (token: string, enabled: boolean) => useQuery({queryKey: ['aula', 'mi-intento', token],
  enabled: !!token && enabled,
  queryFn: () => api.get<{data: Attempt | null}>(`${base}/recursos/${token}/mi-intento?opaque=1`).then(r => r.data)})
export const useGuardarRespuestas = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; respuestas: Attempt['respuestas']}) =>
    api.put(`${base}/intentos/${input.token}/respuestas?opaque=1`, {respuestas: input.respuestas}),
  onSuccess: (_, input) => client.setQueryData<Attempt>(['aula', 'intento', input.token],
    current => current ? {...current, respuestas: input.respuestas} : current),
})}
export const useCambiarPaginaIntento = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; pagina: number}) => api.put<{data: Attempt}>(
    `${base}/intentos/${input.token}/pagina?opaque=1`, {pagina: input.pagina}).then(r => r.data),
  onSuccess: (result, input) => client.setQueryData(['aula', 'intento', input.token], result),
})}
export const useFinalizarIntento = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (token: string) => api.post<{data: {estado: string; nota: string | null;
    valoracion?: {nombre: string; emoji: string | null} | null; transferida_planilla: boolean;
    estado_planilla: 'no_aplica' | 'transferida' | 'nota_oficial_existente' | 'pendiente'}}>(
    `${base}/intentos/${token}/finalizar?opaque=1`, {}).then(r => r.data),
  onSuccess: () => refetchAula(client, true),
})}
export const useReportarIncidente = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; tipo: 'visibilidad' | 'pantalla_completa' | 'desconexion'}) =>
    api.post<{data: {estado: string; incidentes: number}}>(`${base}/intentos/${input.token}/incidentes?opaque=1`, {tipo: input.tipo}).then(r => r.data),
  onSuccess: (result, input) => client.setQueryData<Attempt>(['aula', 'intento', input.token],
    current => current ? {...current, estado: result.estado, incidentes: result.incidentes} : current),
})}
export const useIntentos = (token: string, enabled: boolean) => useQuery({queryKey: ['aula', 'intentos', token], enabled: !!token && enabled,
  queryFn: () => api.get<{data: {token: string; estudiante: string; estado: string; numero: number;
    nota: string | null; escala_opcion_token: string | null; incidentes: number; version: number;
    estado_planilla: 'no_aplica' | 'nota_oficial_existente' | 'pendiente'}[]}>(`${base}/recursos/${token}/intentos?opaque=1`).then(r => r.data)})
export const useReintentarPlanilla = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; motivo: string}) => api.post(`${base}/intentos/${input.token}/reintentar-planilla?opaque=1`,
    {motivo: input.motivo}), onSuccess: () => refetchAula(client, true),
})}
export const useCalificarIntento = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number; nota?: string; escala_opcion_token?: string; motivo: string}) =>
    api.put(`${base}/intentos/${input.token}/calificar?opaque=1`, input), onSuccess: () => refetchAula(client, true),
})}
export const useReactivarIntento = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; motivo: string}) => api.post(`${base}/intentos/${input.token}/reactivar?opaque=1`, {motivo: input.motivo}),
  onSuccess: () => refetchAula(client),
})}
