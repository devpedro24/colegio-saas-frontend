import {useEffect, useState, type FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {
  useApproveBulletinObservation, useBulletinObservations, useSaveBulletinObservation,
  type BulletinObservation, type ObservationTarget,
} from '../observaciones.api'

function ObservationEditor({matriculaToken, title, target, observation, canEdit, canApprove}: {
  matriculaToken: string
  title: string
  target: ObservationTarget
  observation: BulletinObservation | null
  canEdit: boolean
  canApprove: boolean
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [content, setContent] = useState(observation?.contenido ?? '')
  const save = useSaveBulletinObservation(matriculaToken)
  const approve = useApproveBulletinObservation(matriculaToken)
  useEffect(() => {setContent(observation?.contenido ?? '')}, [observation?.contenido, observation?.version])
  const dirty = content.trim() !== (observation?.contenido ?? '')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit || !content.trim() || !dirty) return
    save.mutate({...target, contenido: content.trim(), version: observation?.version ?? 0})
  }

  return <form className='border rounded p-5' onSubmit={submit}>
    <div className='d-flex justify-content-between align-items-center mb-3'>
      <h5 className='mb-0'>{title}</h5>
      <span className={`badge ${observation?.estado === 'aprobada' ? 'badge-light-success' : 'badge-light-warning'}`}>
        {t(!observation ? 'boletines.observation.empty' : observation.estado === 'aprobada'
          ? 'boletines.observation.approved' : 'boletines.observation.pending')}
      </span>
    </div>
    <label className='form-label' htmlFor={`observation-${target.periodo_token ?? 'final'}`}>{t('boletines.observation.label')}</label>
    <textarea id={`observation-${target.periodo_token ?? 'final'}`} className='form-control' rows={4} maxLength={4000}
      value={content} disabled={!canEdit || save.isPending || approve.isPending}
      onChange={event => setContent(event.target.value)} />
    {observation && <p className='text-muted fs-8 mt-2 mb-0'>
      {t('boletines.observation.version')} {observation.version}
      {observation.autor && ` · ${t('boletines.observation.lastEditedBy')} ${observation.autor}`}
      {observation.aprobador && ` · ${t('boletines.observation.approvedBy')} ${observation.aprobador}`}
    </p>}
    {(save.isError || approve.isError) && <div className='alert alert-danger mt-3' role='alert'>
      {(save.error ?? approve.error)?.message}
    </div>}
    <div className='d-flex justify-content-end gap-2 mt-4'>
      {canEdit && <button type='submit' className='btn btn-light-primary btn-sm' disabled={!dirty || !content.trim() || save.isPending}>
        {t('boletines.observation.save')}
      </button>}
      {canApprove && observation && observation.estado !== 'aprobada' && <button type='button' className='btn btn-primary btn-sm'
        disabled={dirty || approve.isPending} onClick={() => approve.mutate({...target, version: observation.version})}>
        {t('boletines.observation.approve')}
      </button>}
    </div>
  </form>
}

export function BulletinObservationCard({matriculaToken}: {matriculaToken: string}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const query = useBulletinObservations(matriculaToken, true)
  return <div className='card mt-5 d-print-none'>
    <div className='card-header'><h3 className='card-title'>{t('boletines.observation.title')}</h3></div>
    <div className='card-body'>
      <p className='text-muted'>{t('boletines.observation.help')}</p>
      {query.isLoading && <p role='status'>{t('boletines.observation.loading')}</p>}
      {query.isError && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
      {query.data && <div className='d-flex flex-column gap-5'>
        {query.data.periodos.map(period => <ObservationEditor key={period.periodo_token} matriculaToken={matriculaToken}
          title={period.nombre} target={{contexto: 'periodo', periodo_token: period.periodo_token}}
          observation={period.observacion} canEdit={query.data!.puede_editar} canApprove={query.data!.puede_aprobar} />)}
        <ObservationEditor matriculaToken={matriculaToken} title={t('boletines.observation.final')}
          target={{contexto: 'final'}} observation={query.data.final}
          canEdit={query.data.puede_editar} canApprove={query.data.puede_aprobar} />
        <p className='text-muted mb-0'>{t(query.data.politica.requiere_observacion_final
          ? 'boletines.observation.finalRequired' : 'boletines.observation.finalOptional')}</p>
      </div>}
    </div>
  </div>
}
