import {useState} from 'react'
import {useIntl} from 'react-intl'
import {useGuardarZonaHorariaInstitucional, useZonaHorariaInstitucional} from '../configuracion.api'

export function ZonaHorariaCard() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {data, isLoading, error} = useZonaHorariaInstitucional()
  const save = useGuardarZonaHorariaInstitucional()
  const [choice, setChoice] = useState('')
  const [message, setMessage] = useState('')
  const selected = choice || data?.data.zona_horaria || 'America/Bogota'
  const zones = data?.data.zonas ?? []
  const byOffset = zones.reduce<Record<string, typeof zones>>((result, zone) => {
    ;(result[zone.offset] ??= []).push(zone)
    return result
  }, {})

  return <div className='card'><div className='card-body p-6 p-lg-10'>
    <div className='d-flex align-items-center gap-3 mb-3'>
      <span className='symbol symbol-45px bg-light-success rounded d-flex align-items-center justify-content-center' aria-hidden='true'>
        <i className='ki-solid ki-time text-success fs-2' /></span>
      <div><h2 className='fs-3 fw-bold mb-1'>{t('academico.timezone.title')}</h2>
        <p className='text-muted mb-0'>{t('academico.timezone.description')}</p></div>
    </div>
    <div className='alert alert-light-success border border-success-subtle my-6'>
      {t('academico.timezone.help')}
    </div>
    {isLoading ? <p>{t('academico.timezone.loading')}</p> : error ? <div className='alert alert-danger' role='alert'>{error.message}</div> : <>
      <div className='row g-4 align-items-end'>
        <div className='col-12'><label className='form-label fw-semibold' htmlFor='institution-zone'>{t('academico.timezone.select')}</label>
          <select id='institution-zone' className='form-select' value={selected} onChange={event => setChoice(event.target.value)}>
            {Object.entries(byOffset).map(([offset, entries]) => <optgroup key={offset} label={offset}>
              {entries.map(zone => <option key={zone.id} value={zone.id}>
                ({zone.offset}) {zone.id.split('/').at(-1)?.replace(/_/g, ' ')} — {zone.id}
              </option>)}
            </optgroup>)}
          </select></div>
      </div>
      <p className='text-muted mt-4 mb-0'>{t('academico.timezone.current')}: <strong>{data?.data.zona_horaria}</strong></p>
      {message && <div className={`alert ${message === 'saved' ? 'alert-success' : 'alert-danger'} mt-4`} role='status'>
        {message === 'saved' ? t('academico.timezone.saved') : message}</div>}
      <div className='d-flex justify-content-end mt-6'><button type='button' className='btn btn-success' disabled={save.isPending || !zones.some(zone => zone.id === selected)}
        onClick={() => void save.mutateAsync(selected).then(() => {setChoice(''); setMessage('saved')})
          .catch(cause => setMessage(cause instanceof Error ? cause.message : t('academico.timezone.error')))}>
        {save.isPending ? t('academico.timezone.saving') : t('academico.timezone.save')}
      </button></div>
    </>}
  </div></div>
}
