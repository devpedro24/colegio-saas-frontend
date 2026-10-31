import type {ActividadEvaluacion} from './evaluacion.types'
import {gradeDecimal} from './gradeDecimal'

export type ActivityEditRow = {token: string; version: number; nombre: string; fecha: string; peso: string}
export type ActivityEdit = {base: ActivityEditRow[]; rows: ActivityEditRow[]; mode: string; componentVersion: number}

export const activityEditRows = (activities: ActividadEvaluacion[]): ActivityEditRow[] => activities.map(activity => ({
  token: activity.url_token, version: activity.version, nombre: activity.nombre,
  fecha: activity.fecha.slice(0, 10), peso: gradeDecimal(activity.peso),
}))

export function activityEditIsCurrent(edit: ActivityEdit, current: ActivityEditRow[], mode: string, version: number): boolean {
  return edit.mode === mode && edit.componentVersion === version && edit.base.length === current.length && edit.base.every(row =>
    current.some(item => item.token === row.token && item.version === row.version))
}

export function validateActivityEdit(rows: ActivityEditRow[], weighted: boolean, start: string, end: string) {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }
  const weightsValid = !weighted || rows.every(row => /^\d+(?:\.\d{1,4})?$/.test(row.peso)
    && Number(row.peso) > 0 && Number(row.peso) <= 100)
  // Integer units keep a four-decimal percentage total exact (33.3333 + 33.3333 + 33.3334).
  const units = weightsValid && weighted ? rows.reduce((sum, row) => sum + Math.round(Number(row.peso) * 10000), 0) : 0
  const fieldsValid = rows.length > 0 && rows.every(row => row.nombre.trim().length > 0 && row.nombre.trim().length <= 160
    && validDate(row.fecha) && row.fecha >= start && row.fecha <= end)
  return {valid: fieldsValid && weightsValid && (!weighted || units <= 1000000),
    weightsValid: weightsValid && (!weighted || units <= 1000000), total: units / 10000,
    complete: !weighted || units === 1000000}
}
