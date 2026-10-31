import {useEffect, useState} from 'react'
import {api} from '@/lib/api/client'
import {fromOpaqueAcademic, toOpaqueAcademic} from '../shared/opaqueAcademic'
import {validGrade} from './gradeDecimal'
import type {NotaUpdate, PlanillaResponse, ResultadoEstudiante} from './evaluacion.types'

/** Uses the same exact SIEE calculator as Save; never changes the academic cache. */
export function useGradePreview(assignment: string, period: string, data: PlanillaResponse | undefined,
  draft: Record<string, Omit<NotaUpdate, 'motivo'>>) {
  const serialized = JSON.stringify(Object.values(draft).map(({actividad_id, matricula_id, valor, escala_opcion_token, version}) =>
    ({actividad_id, matricula_id, valor, escala_opcion_token, version})))
  const visual = data?.escala_visual?.tipo === 'imagenes'
  const valid = !!data?.editable && Object.values(draft).every(row => visual
    ? !row.escala_opcion_token || data.escala_visual?.opciones.some(choice => choice.url_token === row.escala_opcion_token)
    : validGrade(row.valor ?? '', data.configuracion.valor_min, data.configuracion.valor_max))
  const [preview, setPreview] = useState<{signature: string; results: ResultadoEstudiante[]; error?: string} | null>(null)
  useEffect(() => {
    if (serialized === '[]' || !valid) return
    let active = true
    const timer = setTimeout(() => {
      void api.post<{data: {resultados: unknown[]}}>(`/evaluacion/planillas/${assignment}/${period}/vista-previa?opaque=1`,
        {notas: (JSON.parse(serialized) as NotaUpdate[]).map(row => toOpaqueAcademic(row))}, {notifyLocalChange: false})
        .then(response => {if (active) setPreview({signature: serialized, results: fromOpaqueAcademic<ResultadoEstudiante[]>(response.data.resultados)})})
        .catch((error: Error) => {if (active) setPreview({signature: serialized, results: [], error: error.message})})
    }, 350)
    return () => {active = false; clearTimeout(timer)}
  }, [assignment, period, serialized, valid])
  const current = valid && preview?.signature === serialized ? preview : null
  return {results: new Map(current?.results.map(row => [row.matricula_id, row])),
    pending: serialized !== '[]' && valid && !current, invalid: serialized !== '[]' && !valid, error: current?.error}
}
