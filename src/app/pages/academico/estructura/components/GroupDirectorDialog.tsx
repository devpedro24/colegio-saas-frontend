import {useEffect, useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {AcademicOptionSelect} from '../../shared/AcademicOptionSelect'
import {useGroupDirector, useSaveGroupDirector} from '../estructura.api'
import type {Grupo} from '../estructura.types'

export function GroupDirectorDialog({group, onClose}: {group: Grupo | null; onClose: () => void}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const detail = useGroupDirector(group?.id ?? null)
  const save = useSaveGroupDirector(group?.id ?? '')
  const [teacherToken, setTeacherToken] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setTeacherToken(detail.data?.docente_token ?? '')
    setReason('')
    setError('')
  }, [group?.id, detail.data?.version])

  const changed = teacherToken !== (detail.data?.docente_token ?? '')
  const reasonRequired = changed && (detail.data?.version ?? 0) > 0

  return <Modal show={!!group} onHide={onClose} centered>
    <Modal.Header closeButton><Modal.Title>{t('academico.estructura.director.title')}</Modal.Title></Modal.Header>
    <Modal.Body>
      {group && <p className='text-muted'>{group.grado?.nombre} / {group.nombre}</p>}
      {detail.isLoading && <p role='status'>{t('academico.estructura.director.loading')}</p>}
      {detail.isError && <div className='alert alert-danger' role='alert'>{detail.error.message}</div>}
      {detail.data && group && <>
        <AcademicOptionSelect tipo='docentes' yearId={group.ano_lectivo_id} opaque selectOnly
          label={t('academico.estructura.director.teacher')} value={teacherToken} onChange={setTeacherToken}
          initialOptions={detail.data.docente_token ? [{url_token: detail.data.docente_token,
            name: detail.data.docente_nombre ?? ''}] : []}
          emptyLabel={t('academico.estructura.director.none')} />
        {reasonRequired && <div className='mt-4'>
          <label className='form-label required' htmlFor='group-director-reason'>{t('academico.estructura.director.reason')}</label>
          <textarea id='group-director-reason' className='form-control' maxLength={1000} minLength={8}
            value={reason} onChange={event => setReason(event.target.value)} rows={3} />
        </div>}
        {detail.data.historial.length > 0 && <div className='mt-5'>
          <h4 className='fs-6'>{t('academico.estructura.director.history')}</h4>
          <ul className='list-unstyled text-muted mb-0'>
            {detail.data.historial.map(item => <li className='border-top py-2' key={item.version}>
              {item.nuevo ?? t('academico.estructura.director.none')} · {item.actor ?? '—'}
              {item.motivo && <span className='d-block'>{item.motivo}</span>}
            </li>)}
          </ul>
        </div>}
      </>}
      {error && <div className='alert alert-danger mt-4' role='alert'>{error}</div>}
    </Modal.Body>
    <Modal.Footer>
      <button type='button' className='btn btn-light' onClick={onClose}>{t('common.cancel')}</button>
      <button type='button' className='btn btn-primary' disabled={!detail.data || !changed || save.isPending || (reasonRequired && reason.trim().length < 8)}
        onClick={() => save.mutate({docente_token: teacherToken || null, version: detail.data!.version,
          ...(reasonRequired ? {motivo: reason.trim()} : {})}, {
          onSuccess: () => {toast.success(t('academico.estructura.director.saved')); onClose()},
          onError: cause => setError(cause instanceof ApiError ? cause.message : t('common.toast.saveError')),
        })}>{t('academico.estructura.director.save')}</button>
    </Modal.Footer>
  </Modal>
}
