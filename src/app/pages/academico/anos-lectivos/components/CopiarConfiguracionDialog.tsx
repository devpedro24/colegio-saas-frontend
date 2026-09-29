import {useEffect, useState, type FormEvent} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCopiarConfiguracionAno, useEstadoCopiaAno} from '../anos-lectivos.api'
import type {AnoLectivo} from '../anos-lectivos.types'
import {options} from './DuplicarAnoLectivoDialog'
import './year-dialog.css'

function CopyForm({target, years, onClose}: {
  target: AnoLectivo; years: AnoLectivo[]; onClose: () => void
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const copy = useCopiarConfiguracionAno()
  const status = useEstadoCopiaAno(target.id)
  const [sourceId, setSourceId] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(options.map(key => [key, false])))
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const sources = years.filter(year => year.id !== target.id)
  const previousSourceId = status.data?.data.origen_id?.toString() ?? ''
  const switchingBlocked = !!previousSourceId && sourceId !== previousSourceId && !status.data?.data.reemplazable

  useEffect(() => {
    if (!status.data || status.isFetching || loaded) return
    setSourceId(status.data.data.origen_id?.toString() ?? '')
    setSelected(status.data.data.opciones)
    setLoaded(true)
  }, [status.data, status.isFetching, loaded])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    copy.mutate({id: target.id, origenId: sourceId, opciones: selected}, {
      onSuccess: () => {toast.success(t('academico.anos.copyLater.success')); onClose()},
      onError: err => setError(err instanceof ApiError
        ? err.fieldError('origen_id') ?? err.fieldError('opciones') ?? err.message
        : t('common.toast.genericError')),
    })
  }

  return <form onSubmit={submit}>
    <Modal.Body>
      <p className='text-muted'>{t('academico.anos.copyLater.help')}</p>
      {status.isLoading && <div className='text-muted mb-4'>{t('academico.anos.copyLater.loading')}</div>}
      {status.isError && <div className='alert alert-danger'>{t('academico.anos.copyLater.loadError')}</div>}
      {switchingBlocked && <div className='alert alert-warning'>{t('academico.anos.copyLater.locked')}</div>}
      {error && <div className='alert alert-danger' role='alert'>{error}</div>}
      <label className='form-label required' htmlFor='copy-year-source'>{t('academico.anos.copyLater.source')}</label>
      <select id='copy-year-source' className='form-select mb-6' required value={sourceId}
        onChange={event => setSourceId(event.target.value)}>
        <option value=''>{t('academico.anos.copyLater.selectSource')}</option>
        {sources.map(year => <option key={year.id} value={year.id}>{year.nombre}</option>)}
      </select>
      <h5>{t('academico.anos.duplicate.copy')} <span className='text-danger'>*</span></h5>
      <div className='row g-4'>
        {options.map(key => <div className='col-md-6' key={key}><label className='d-flex align-items-center gap-3 rounded border p-4 h-100 cursor-pointer'>
          <input className='form-check-input' type='checkbox' checked={!!selected[key]}
            onChange={event => setSelected(current => ({...current, [key]: event.target.checked}))} />
          <span className='form-check-label flex-grow-1'>{t(`academico.anos.duplicate.option.${key}`)}</span>
          {status.data?.data.opciones[key] && <span className='badge badge-light-info'>{t('academico.anos.copyLater.existing')}</span>}
        </label></div>)}
      </div>
      <p className='text-muted fs-7 mt-5 mb-0'>{t('academico.anos.duplicate.dependencies')}</p>
      <p className='text-muted fs-7'>{t('academico.anos.duplicate.excluded')}</p>
    </Modal.Body>
    <Modal.Footer>
      <button type='button' className='btn btn-light' onClick={onClose}>{t('common.cancel')}</button>
      <button type='submit' className='btn btn-primary' disabled={copy.isPending || !loaded || status.isError || switchingBlocked || !sourceId || !Object.values(selected).some(Boolean)}>
        {t('academico.anos.copyLater.action')}
      </button>
    </Modal.Footer>
  </form>
}

export function CopiarConfiguracionDialog({target, years, onClose}: {
  target: AnoLectivo | null; years: AnoLectivo[]; onClose: () => void
}) {
  const intl = useIntl()
  return <Modal show={!!target} onHide={onClose} centered scrollable size='lg' dialogClassName='academic-year-dialog'>
    <Modal.Header closeButton>
      <Modal.Title>{intl.formatMessage({id: 'academico.anos.copyLater.title'})}</Modal.Title>
    </Modal.Header>
    {target && <CopyForm key={target.id} target={target} years={years} onClose={onClose} />}
  </Modal>
}
