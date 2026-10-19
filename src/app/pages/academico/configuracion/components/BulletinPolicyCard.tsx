import {useEffect, useState, type FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {useBulletinPolicy, useSaveBulletinPolicy, type BulletinPolicy} from '../../boletines/observaciones.api'

export function BulletinPolicyCard() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const query = useBulletinPolicy(true)
  const save = useSaveBulletinPolicy()
  const [values, setValues] = useState<BulletinPolicy | null>(null)
  useEffect(() => {if (query.data) setValues(query.data)}, [query.data])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (values && !save.isPending) save.mutate(values)
  }

  return <form className='card' onSubmit={submit}>
    <div className='card-header'><h3 className='card-title'>{t('boletines.policy.title')}</h3></div>
    <div className='card-body'>
      <p className='text-muted'>{t('boletines.policy.help')}</p>
      {query.isLoading && <p role='status'>{t('boletines.policy.loading')}</p>}
      {query.isError && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
      {values && <div className='d-flex flex-column gap-5'>
        <label className='form-check form-switch form-check-custom form-check-solid'>
          <input className='form-check-input' type='checkbox' checked={values.requiere_observacion_final}
            onChange={event => setValues({...values, requiere_observacion_final: event.target.checked})} />
          <span className='form-check-label'>{t('boletines.policy.finalRequired')}</span>
        </label>
        <label className='form-check form-switch form-check-custom form-check-solid'>
          <input className='form-check-input' type='checkbox' checked={values.docente_edita_indicadores_grupo}
            aria-describedby='teacher-indicator-help'
            onChange={event => setValues({...values, docente_edita_indicadores_grupo: event.target.checked})} />
          <span className='form-check-label'>{t('boletines.policy.teacherGroup')}</span>
        </label>
        <p id='teacher-indicator-help' className='text-muted mb-0'>{t('boletines.policy.teacherGroupHelp')}</p>
      </div>}
      {save.isError && <div className='alert alert-danger mt-5' role='alert'>{save.error.message}</div>}
      {save.isSuccess && <div className='alert alert-success mt-5' role='status'>{t('boletines.policy.saved')}</div>}
    </div>
    <div className='card-footer d-flex justify-content-end'>
      <button className='btn btn-primary' type='submit' disabled={!values || save.isPending}>{t('boletines.policy.save')}</button>
    </div>
  </form>
}
