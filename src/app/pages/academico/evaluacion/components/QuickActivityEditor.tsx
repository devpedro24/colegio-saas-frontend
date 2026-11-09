import {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {useActividadPlanilla} from '../evaluacion.api'
import {activityEditIsCurrent, activityEditRows, validateActivityEdit, type ActivityEdit} from '../activityEditing'
import type {SeccionPlanilla} from '../evaluacion.types'
import {useWorkDraft} from '@/lib/drafts/WorkDrafts'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'

export function QuickActivityEditor({assignment, period, section, periodStart, periodEnd, editable, onDirtyChange}: {
  assignment: string; period: string; section: SeccionPlanilla; periodStart: string; periodEnd: string
  editable: boolean; onDirtyChange: (dirty: boolean) => void
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const mutation = useActividadPlanilla(assignment, period)
  const [edit, setEdit] = useState<ActivityEdit | null>(null)
  const current = activityEditRows(section.actividades)
  const rows = edit?.rows ?? current
  const weighted = section.modo === 'WEIGHTED_AVERAGE'
  const stale = !!edit && !activityEditIsCurrent(edit, current, section.modo, section.version)
  const start = periodStart.slice(0, 10)
  const end = periodEnd.slice(0, 10)
  const validation = validateActivityEdit(rows, weighted, start, end)
  const dirty = !!edit
  const recovery = useWorkDraft({context: `grade-activities:${assignment}:${period}:${section.preinforme_token ?? section.componente_token}`,
    title: section.nombre ?? t('grading.quickActivities'), value: edit, dirty, enabled: editable,
    restore: setEdit, reset: () => setEdit(null),
    compatible: value => !!value && activityEditIsCurrent(value, current, section.modo, section.version)})

  useEffect(() => {onDirtyChange(dirty)}, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const change = (token: string, field: 'nombre' | 'fecha' | 'peso', value: string) => {
    setEdit(previous => {
      const base = previous?.base ?? current
      const updated = (previous?.rows ?? current).map(row => row.token === token ? {...row, [field]: value} : row)
      return JSON.stringify(updated) === JSON.stringify(base) ? null : {base, rows: updated,
        mode: previous?.mode ?? section.modo, componentVersion: previous?.componentVersion ?? section.version}
    })
  }
  const save = () => {
    if (!edit || !editable || stale || !validation.valid || mutation.isPending) return
    const finishDraft = recovery.afterSave()
    mutation.mutate({operacion: 'editar_lote', componente_token: section.componente_token,
      preinforme_token: section.preinforme_token, version: edit.componentVersion,
      actividades: rows.map(row => ({actividad_token: row.token, version: row.version,
        nombre: row.nombre.trim(), fecha: row.fecha, ...(weighted ? {peso: row.peso} : {})})),
    }, {onSuccess: () => {finishDraft(); setEdit(null); toast.success(t('grading.saved'), 'updated')},
      onError: error => toast.error(error instanceof ApiError ? Object.values(error.errors ?? {}).flat()[0] ?? error.message : error.message)})
  }

  return <section className='grade-quick-activities' aria-label={t('grading.quickActivities')}>
    {recovery.notice}
    <div className='grade-quick-heading'>
      <div><h3>{t('grading.quickActivities')}</h3><p>{t('grading.quickActivitiesHelp')}</p></div>
      {dirty && <div className='grade-quick-actions'>
        <button type='button' className='btn btn-sm btn-light' disabled={mutation.isPending} onClick={() => {setEdit(null); mutation.reset()}}>{t('grading.cancel')}</button>
        <button type='button' className='btn btn-sm btn-primary' disabled={!editable || stale || !validation.valid || mutation.isPending}
          onClick={save}>{t(mutation.isPending ? 'grading.saving' : 'grading.saveActivities')}</button>
      </div>}
    </div>
    {stale && <p className='alert alert-warning' role='alert'>{t('grading.activitiesStale')}</p>}
    {weighted && !validation.weightsValid && <p className='alert alert-warning' role='alert'>{t('grading.batchWeightInvalid')}</p>}
    {weighted && validation.weightsValid && !validation.complete && <p className='grade-quick-weight-note' role='status'>{t('grading.batchWeightPartial')}</p>}
    {!rows.length && <p className='text-muted mb-0'>{t('grading.noActivities')}</p>}
    {rows.map((row, index) => <div className={`grade-quick-row${weighted ? ' is-weighted' : ''}`} key={row.token}>
      <span className='grade-quick-number' aria-hidden='true'>{index + 1}</span>
      <div className='grade-quick-name'><label htmlFor={`activity-name-${row.token}`}>{t('grading.name')}</label>
        <input id={`activity-name-${row.token}`} className='form-control form-control-sm' maxLength={160} required
          disabled={!editable || stale || mutation.isPending} value={row.nombre}
          onChange={event => change(row.token, 'nombre', event.target.value)} /></div>
      <div><label htmlFor={`activity-date-${row.token}`}>{t('grading.date')}</label>
        <input id={`activity-date-${row.token}`} className='form-control form-control-sm' type='date' min={start} max={end} required
          disabled={!editable || stale || mutation.isPending} value={row.fecha}
          onChange={event => change(row.token, 'fecha', event.target.value)} /></div>
      {weighted && <div><label htmlFor={`activity-weight-${row.token}`}>{t('grading.weight')}</label>
        <input id={`activity-weight-${row.token}`} className='form-control form-control-sm' inputMode='decimal' required
          disabled={!editable || stale || mutation.isPending} value={row.peso} aria-invalid={!validation.weightsValid}
          onChange={event => change(row.token, 'peso', event.target.value.replace(',', '.'))} /></div>}
    </div>)}
    {weighted && validation.weightsValid && <div className='grade-quick-total'>{t('grading.total')}: <strong>{validation.total}% / 100%</strong></div>}
  </section>
}
