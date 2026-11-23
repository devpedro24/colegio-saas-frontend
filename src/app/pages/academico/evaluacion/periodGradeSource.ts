import type {ResultadoEstudiante} from './evaluacion.types'

export function periodGradeSource(origin?: string, certificateReceived?: boolean) {
  if (origin === 'colegio') return 'grading.schoolFinal'
  if (origin === 'pendiente_eleccion') return 'grading.pendingChoice'
  if (origin === 'externa') return 'grading.externalFinal'
  if (origin === 'valoracion') return 'grading.entryAssessment'
  if (origin === 'traslado') return 'grading.transferFinal'
  if (origin === 'sin_equivalencia') return 'grading.noEquivalence'
  if (origin === 'pendiente_certificado') return certificateReceived ? 'grading.pendingEquivalence' : 'grading.pendingCertificate'
  if (origin === 'pendiente_traslado') return 'grading.transferPending'
  if (origin === 'consolidacion') return 'grading.splitFinal'
  if (origin === 'pendiente_consolidacion') return 'grading.splitPending'
  return undefined
}

export function activitiesLocked(origin?: string) {
  return origin !== 'pendiente_consolidacion' && !!periodGradeSource(origin)
}

export function activityApplies(result: Pick<ResultadoEstudiante, 'intervalos_grupo' | 'actividades_apoyo'> | undefined, date?: string | null, token?: string) {
  if (token && result?.actividades_apoyo?.some(a => a.actividad_token === token)) return true
  return !result?.intervalos_grupo || !!date && result.intervalos_grupo.some(s => s.desde <= date.slice(0, 10) && date.slice(0, 10) <= s.hasta)
}
