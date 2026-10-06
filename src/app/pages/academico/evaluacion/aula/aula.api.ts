import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'

export type AulaCard = {aula_token: string | null; grupo_token: string; grupo: string; materia_token: string;
  materia: string; docente: string; portada_token: string | null}
export type AulaScale = {tipo: 'numerica' | 'imagenes'; nombre?: string; opciones: {
  url_token: string; nombre: string; emoji: string | null; imagen_url: string | null}[]}
export type AulaResource = {token: string; tipo: 'texto' | 'archivo' | 'tarea' | 'cuestionario'; titulo: string;
  contenido: {bloques: {tipo: string; texto?: string; url?: string}[]}; estado: string; visible_estudiantes: boolean;
  calificable: boolean; llevar_planilla: boolean; actividad_token: string | null; peso: string | null;
  disponible_desde: string | null; disponible_hasta: string | null; fecha_limite: string | null;
  zona_publicacion: string | null; version: number; configuracion?: Record<string, unknown>;
  preguntas?: Question[]; cantidad_preguntas?: number; adjuntos?: {token: string; nombre: string; es_imagen?: boolean}[];
  escala?: AulaScale; requiere_motivo?: boolean; puede_interactuar?: boolean;
  estudiante?: boolean; puede_gestionar?: boolean; puede_calificar?: boolean; puede_evaluar?: boolean;
  entrega?: {token: string; texto: string; estado: string; nota: string | null;
    valoracion?: {nombre: string; emoji: string | null; imagen_url: string | null} | null; retroalimentacion: string | null;
    adjuntos: {token: string; nombre: string}[]} | null}
export type Question = {token: string; tipo: string; enunciado: string; opciones: string[] | null; puntos: string;
  respuesta_correcta?: {valor: string | string[]}}
export type AulaSection = {token: string; titulo: string; periodo: string; periodo_token: string; preinforme_token: string | null;
  visible_estudiantes: boolean; orden: number; recursos: AulaResource[]}
export type AulaDetail = {token: string; grupo: string; materia: string; portada_token: string | null; estudiante: boolean;
  puede_gestionar: boolean; periodos: {token: string; nombre: string; estado: string;
    preinformes: {token: string; nombre: string}[]}[]; secciones: AulaSection[]}
export type ResourceInput = {tipo: AulaResource['tipo']; titulo: string; contenido: {bloques: {tipo: string; texto?: string; url?: string}[]};
  estado: string; visible_estudiantes: boolean; calificable: boolean; llevar_planilla: boolean;
  peso?: string | null; disponible_desde?: string | null; disponible_hasta?: string | null;
  fecha_limite?: string | null; configuracion?: Record<string, unknown>; version?: number}
export type Attempt = {token: string; estado: string; vence_at: string; numero: number; incidentes: number;
  vigilado: boolean; incidentes_permitidos: number; respuestas: Record<string, string | string[]>; preguntas: Question[];
  nota: string | null; valoracion?: {nombre: string; emoji: string | null} | null;
  pagina_actual: number; preguntas_por_pagina: number; preguntas_total: number;
  permitir_regresar: boolean; permitir_editar_respuestas: boolean}

const base = '/aula'
const refetchAula = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({queryKey: ['aula']})
  void client.invalidateQueries({queryKey: ['evaluacion', 'planillas']})
}
export const useAulaCatalogo = (year: string, group: string) => useQuery({queryKey: ['aula', 'catalogo', year, group],
  queryFn: () => api.get<{data: {anos: {token: string; nombre: string; estado: string}[];
    ano_token: string | null; grupos: {token: string; nombre: string; grado: string; etiqueta: string}[];
    grupo_seleccionado: string | null; requiere_grupo: boolean; aulas: AulaCard[];
    puede_gestionar: boolean}}>(`${base}/catalogo?opaque=1${year ? `&ano_token=${encodeURIComponent(year)}` : ''}${group ? `&grupo_token=${encodeURIComponent(group)}` : ''}`)
    .then(response => response.data)})
export const useAula = (token: string) => useQuery({queryKey: ['aula', token], enabled: !!token,
  queryFn: () => api.get<{data: AulaDetail}>(`${base}/${encodeURIComponent(token)}?opaque=1`).then(response => response.data)})
export const useAulaRecurso = (token: string) => useQuery({queryKey: ['aula', 'recurso', token], enabled: !!token,
  queryFn: () => api.get<{data: AulaResource}>(`${base}/recursos/${encodeURIComponent(token)}?opaque=1`).then(response => response.data)})
export const useCrearAula = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {grupo_token: string; materia_token: string}) => api.post<{data: {token: string}}>(`${base}?opaque=1`, input).then(r => r.data),
  onSuccess: () => refetchAula(client),
})}
export const useCrearSeccion = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {aula: string; periodo_token: string; preinforme_token: string | null; titulo: string}) =>
    api.post(`${base}/${input.aula}/secciones?opaque=1`, input), onSuccess: () => refetchAula(client),
})}
export const useEditarSeccion = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; titulo?: string; visible_estudiantes?: boolean}) =>
    api.put(`${base}/secciones/${input.token}?opaque=1`, input), onSuccess: () => refetchAula(client),
})}
export const useGuardarRecurso = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {section: string; token?: string; data: ResourceInput}) => input.token
    ? api.put(`${base}/recursos/${input.token}?opaque=1`, input.data)
    : api.post(`${base}/secciones/${input.section}/recursos?opaque=1`, input.data),
  onSuccess: () => refetchAula(client),
})}
export const useEntregarTarea = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; texto: string}) => api.post(`${base}/recursos/${input.token}/entregas?opaque=1`, {texto: input.texto}),
  onSuccess: () => refetchAula(client),
})}
export const useEntregas = (token: string, enabled: boolean) => useQuery({queryKey: ['aula', 'entregas', token], enabled: !!token && enabled,
  queryFn: () => api.get<{data: {token: string; estudiante: string; texto: string; estado: string; nota: string | null;
    escala_opcion_token: string | null;
    retroalimentacion: string | null; version: number; adjuntos: {token: string; nombre: string}[]}[]}>(`${base}/recursos/${token}/entregas?opaque=1`).then(r => r.data)})
export const useSubirAdjunto = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; archivo: File; destino: 'recursos' | 'entregas'}) => {
    const data = new FormData(); data.append('archivo', input.archivo)
    return api.post(`${base}/${input.destino}/${input.token}/adjuntos?opaque=1`, data)
  }, onSuccess: () => refetchAula(client),
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
export const useCalificarEntrega = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number; nota?: string; escala_opcion_token?: string;
    retroalimentacion: string; motivo?: string}) =>
    api.put(`${base}/entregas/${input.token}/calificar?opaque=1`, input), onSuccess: () => refetchAula(client),
})}
export const useGuardarPreguntas = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; preguntas: {tipo: string; enunciado: string; opciones: string[];
    respuesta_correcta: {valor: string | string[]} | null; puntos: string}[]}) =>
    api.put(`${base}/recursos/${input.token}/preguntas?opaque=1`, {preguntas: input.preguntas}),
  onSuccess: () => refetchAula(client),
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
    valoracion?: {nombre: string; emoji: string | null} | null; transferida_planilla: boolean}}>(
    `${base}/intentos/${token}/finalizar?opaque=1`, {}).then(r => r.data),
  onSuccess: () => refetchAula(client),
})}
export const useReportarIncidente = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; tipo: 'visibilidad' | 'pantalla_completa' | 'desconexion'}) =>
    api.post<{data: {estado: string; incidentes: number}}>(`${base}/intentos/${input.token}/incidentes?opaque=1`, {tipo: input.tipo}).then(r => r.data),
  onSuccess: (result, input) => client.setQueryData<Attempt>(['aula', 'intento', input.token],
    current => current ? {...current, estado: result.estado, incidentes: result.incidentes} : current),
})}
export const useIntentos = (token: string, enabled: boolean) => useQuery({queryKey: ['aula', 'intentos', token], enabled: !!token && enabled,
  queryFn: () => api.get<{data: {token: string; estudiante: string; estado: string; numero: number;
    nota: string | null; escala_opcion_token: string | null; incidentes: number; version: number}[]}>(`${base}/recursos/${token}/intentos?opaque=1`).then(r => r.data)})
export const useCalificarIntento = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; version: number; nota?: string; escala_opcion_token?: string; motivo: string}) =>
    api.put(`${base}/intentos/${input.token}/calificar?opaque=1`, input), onSuccess: () => refetchAula(client),
})}
export const useReactivarIntento = () => {const client = useQueryClient(); return useMutation({
  mutationFn: (input: {token: string; motivo: string}) => api.post(`${base}/intentos/${input.token}/reactivar?opaque=1`, {motivo: input.motivo}),
  onSuccess: () => refetchAula(client),
})}
