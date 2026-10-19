import {useState} from 'react'
import {useIntl} from 'react-intl'
import {useQueryClient} from '@tanstack/react-query'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useEnrollmentScope, useEnrollmentSettings} from './enrollmentSettings.api'
import type {EnrollmentSettings, EnrollmentSettingsInput} from './ingreso.types'

type Draft = Omit<EnrollmentSettings, 'grados'> & {grados: (EnrollmentSettings['grados'][number] & {enabled: boolean})[]}
const edit = (value: EnrollmentSettings): Draft => ({...value, grados: value.grados.map(g => ({...g, enabled: g.edad_min !== null || g.edad_max !== null}))})

export function EnrollmentSettingsCard() {
  const intl = useIntl(), toast = useToast(), qc = useQueryClient()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const levelLabel = (level: string) => ['preescolar', 'primaria', 'secundaria', 'media'].includes(level) ? t(`academico.nivel.${level}`) : level
  const scope = useEnrollmentScope(), query = useEnrollmentSettings()
  const [draft, setDraft] = useState<Draft>()
  const [busy, setBusy] = useState(false), [conflict, setConflict] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const form = draft ?? (query.data ? edit(query.data.data) : undefined)
  const valid = form && form.privacidad.trim().length >= 20 && form.privacidad.length <= 5000 && form.grados.every(g => !g.enabled ||
    (g.edad_min !== null && g.edad_max !== null && Number.isInteger(g.edad_min) && Number.isInteger(g.edad_max) && g.edad_min >= 1 && g.edad_max <= 120 && g.edad_min <= g.edad_max))
  const changeGrade = (token: string, changes: Partial<Draft['grados'][number]>) => {
    if (form) setDraft({...form, grados: form.grados.map(g => g.url_token === token ? {...g, ...changes} : g)})
  }
  async function save() {
    if (!form || !valid || busy || conflict) return
    setBusy(true); setErrors([])
    const input: EnrollmentSettingsInput = {version: form.version, privacidad: form.privacidad.trim(),
      grados: form.grados.map(g => ({url_token: g.url_token, edad_min: g.enabled ? g.edad_min : null, edad_max: g.enabled ? g.edad_max : null}))}
    try {
      const result = await api.put<{data: EnrollmentSettings}>('/ingreso/configuracion', input, {notifyLocalChange: false})
      qc.setQueryData(['ingreso', scope, 'configuracion'], result)
      setDraft(undefined)
      await qc.invalidateQueries({queryKey: ['ingreso', scope], predicate: q => q.queryKey[2] !== 'configuracion'})
      toast.success(t('intake.settings.saved'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setConflict(true)
      else setErrors(error instanceof ApiError && error.errors ? Object.values(error.errors).flat() : [error instanceof Error ? error.message : t('intake.ui.theOperationCouldNotBeCompleted')])
    } finally {setBusy(false)}
  }
  async function reload() {
    setBusy(true)
    const result = await query.refetch()
    if (!result.error) {setDraft(undefined); setConflict(false); setErrors([])}
    setBusy(false)
  }
  return <section className='card' data-testid='enrollment-settings-card'><div className='card-body p-6 p-lg-10'>
    <div className='d-flex align-items-center gap-3 mb-6'><i className='ki-solid ki-setting-2 text-primary fs-2x' aria-hidden='true' />
      <div><h2 className='fs-3 mb-1'>{t('intake.settings.title')}</h2><p className='text-muted mb-0'>{t('intake.settings.description')}</p></div></div>
    {query.isPending && <p role='status'>{t('intake.settings.loading')}</p>}
    {query.error && <div className='alert alert-danger' role='alert'>{query.error.message}<button type='button' className='btn btn-sm btn-light ms-3' disabled={busy} onClick={() => void reload()}>{t('intake.settings.retry')}</button></div>}
    {form && <form onSubmit={e => {e.preventDefault(); void save()}}>
      <p className='text-muted'>{t('intake.settings.timezoneHelp', {timezone: form.zona_horaria})}</p>
      {form.requiere_revision && <div className='alert alert-warning' role='status'>{t('intake.settings.legacyReview')}</div>}
      <fieldset disabled={busy || conflict || !!query.error}>
        <h3 className='fs-5 mt-6'>{t('intake.validation.ageTitle')}</h3><p className='text-muted'>{t('intake.settings.rangeHelp')}</p>
        {!form.grados.length && <p role='status'>{t('intake.settings.noGrades')}</p>}
        <div className='row g-5'>{form.grados.map(g => <div className='col-12 col-lg-6' key={g.url_token}>
          <div className='border rounded p-5 h-100'>
            <h4 className='fs-6 mb-1'>{g.nombre}</h4><p className='text-muted mb-4'>{levelLabel(g.nivel)}</p>
            <div className='form-check form-switch mb-4'><input id={`age-enabled-${g.url_token}`} type='checkbox' className='form-check-input' checked={g.enabled}
              onChange={e => changeGrade(g.url_token, {enabled: e.target.checked, edad_min: null, edad_max: null})} />
              <label className='form-check-label' htmlFor={`age-enabled-${g.url_token}`}>{t('intake.settings.enableRange', {grade: g.nombre})}</label></div>
            {g.enabled ? <div className='row g-4'>{(['edad_min', 'edad_max'] as const).map(key => <div className='col-6' key={key}>
              <label className='form-label required' htmlFor={`${g.url_token}-${key}`}>{t(`intake.validation.${key}`)}</label>
              <input id={`${g.url_token}-${key}`} className='form-control' type='number' step={1} required min={key === 'edad_max' ? g.edad_min ?? 1 : 1} max={120} value={g[key] ?? ''}
                onChange={e => changeGrade(g.url_token, {[key]: e.target.value === '' ? null : Number(e.target.value)})} />
            </div>)}</div> : <p className='text-muted mb-0'>{t('intake.settings.unrestricted')}</p>}
          </div>
        </div>)}</div>
        <label className='form-label required mt-8' htmlFor='enrollment-privacy'>{t('intake.ui.schoolPrivacyNoticeAndConsent')}</label>
        <textarea id='enrollment-privacy' rows={6} className='form-control' required minLength={20} maxLength={5000} value={form.privacidad} onChange={e => setDraft({...form, privacidad: e.target.value})} aria-describedby='enrollment-privacy-help' />
        <p id='enrollment-privacy-help' className='text-muted mt-3'>{t('intake.settings.privacyHelp')}</p>
      </fieldset>
      {errors.length > 0 && <div className='alert alert-danger' role='alert'>{errors.map((message, i) => <p className='mb-1' key={i}>{message}</p>)}</div>}
      {conflict && <div className='alert alert-warning' role='alert'><p>{t('intake.settings.conflict')}</p><button type='button' className='btn btn-light-warning' disabled={busy} onClick={() => void reload()}>{t('intake.settings.reload')}</button></div>}
      <div className='d-flex justify-content-end mt-6'><button className='btn btn-primary' disabled={busy || conflict || !valid || !!query.error}><i className='ki-solid ki-check fs-3' aria-hidden='true' />{t(busy ? 'intake.ui.saving' : 'intake.settings.save')}</button></div>
    </form>}
  </div></section>
}
