import {useEffect, useState, type FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {AcademicYearPicker, useAcademicYear} from '../../academic-year-context'
import {useIndicatorPolicy, useSaveIndicatorPolicy} from '../../evaluacion/indicadores.api'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'

export function IndicatorPolicyCard() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {yearToken} = useAcademicYear()
  const policy = useIndicatorPolicy(yearToken)
  const save = useSaveIndicatorPolicy(yearToken)
  const [mode, setMode] = useState<'' | 'grado' | 'grupo'>('')
  const [teacherEdit, setTeacherEdit] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => {
    if (policy.data) {
      setMode(policy.data.alcance === 'mixto' ? '' : policy.data.alcance)
      setTeacherEdit(policy.data.docente_puede_editar)
      setConfirmed(false)
    }
  }, [policy.data])

  const needsConfirmation = !!policy.data && (
    (mode === 'grupo' && policy.data.alcance !== 'grupo' && policy.data.indicadores_grado > 0)
    || (mode === 'grado' && policy.data.alcance !== 'grado'
      && (policy.data.indicadores_grupo > 0 || policy.data.indicadores_grado > 0))
  )
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!policy.data || !mode || (needsConfirmation && !confirmed)) return
    save.mutate({version: policy.data.version, alcance: mode,
      docente_puede_editar: teacherEdit, confirmar_copia: confirmed}, {
      onSuccess: () => toast.success(t('indicators.saved'), 'updated'),
      onError: error => toast.error(error instanceof ApiError ? Object.values(error.errors ?? {}).flat()[0] ?? error.message : error.message),
    })
  }

  return <form className='card' onSubmit={submit}>
    <div className='card-header d-flex flex-wrap align-items-center justify-content-between gap-3'>
      <h3 className='card-title'>{t('indicators.policy.title')}</h3><AcademicYearPicker />
    </div>
    <div className='card-body'>
      <p className='text-muted'>{t('indicators.policy.help')}</p>
      {policy.isLoading && <p role='status'>{t('common.pleaseWait')}</p>}
      {policy.isError && <div className='alert alert-danger' role='alert'>{policy.error.message}</div>}
      {policy.data && <>
        {policy.data.alcance === 'mixto' && <div className='alert alert-info' role='status'>{t('indicators.policy.mixed')}</div>}
        <fieldset className='border-0 p-0 m-0'>
          <legend className='fs-5 fw-semibold mb-4'>{t('indicators.policy.scope')}</legend>
          <div className='d-flex flex-column gap-4'>
            <label className='form-check form-check-custom form-check-solid'>
              <input className='form-check-input' type='radio' name='indicator-scope' value='grado' checked={mode === 'grado'}
                onChange={() => {setMode('grado'); setTeacherEdit(false); setConfirmed(false)}} />
              <span className='form-check-label'>{t('indicators.policy.grade')}</span>
            </label>
            <label className='form-check form-check-custom form-check-solid'>
              <input className='form-check-input' type='radio' name='indicator-scope' value='grupo' checked={mode === 'grupo'}
                onChange={() => {setMode('grupo'); setConfirmed(false)}} />
              <span className='form-check-label'>{t('indicators.policy.group')}</span>
            </label>
          </div>
        </fieldset>
        <div className='separator my-6' />
        <label className='form-check form-switch form-check-custom form-check-solid'>
          <input className='form-check-input' type='checkbox' checked={teacherEdit} disabled={mode !== 'grupo'}
            onChange={event => setTeacherEdit(event.target.checked)} />
          <span className='form-check-label'>{t('indicators.policy.teacher')}</span>
        </label>
        <p className='text-muted fs-7 mt-3'>{t('indicators.policy.teacherHelp')}</p>
        {needsConfirmation && <div className='alert alert-warning mt-6'>
          <p>{t(mode === 'grupo' ? 'indicators.policy.toGroupWarning' : 'indicators.policy.toGradeWarning')}</p>
          <label className='form-check form-check-custom form-check-solid'>
            <input className='form-check-input' type='checkbox' checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)} />
            <span className='form-check-label'>{t('indicators.policy.confirm')}</span>
          </label>
        </div>}
      </>}
    </div>
    <div className='card-footer d-flex justify-content-end'>
      <button className='btn btn-primary' type='submit' disabled={!mode || !policy.data || save.isPending || (needsConfirmation && !confirmed)}>
        {t('boletines.policy.save')}
      </button>
    </div>
  </form>
}
