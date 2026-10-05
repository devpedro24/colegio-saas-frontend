import {useState} from 'react'
import {useNavigate, useParams, useSearchParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'
import {
  Recuperacion, useAnularRecuperacion, useCrearRecuperacion,
  useRecuperaciones, useRegistrarRecuperacion,
} from '../recuperaciones.api'

export const RecuperacionesView = () => {
  const {matriculaId = ''} = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const backTo = searchParams.get('desde') === 'boletines' ? '/academico/boletines' : '/evaluacion/catalogo'
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const [page, setPage] = useState(1)
  const query = useRecuperaciones(matriculaId, page)
  const create = useCrearRecuperacion(matriculaId)
  const save = useRegistrarRecuperacion(matriculaId)
  const cancel = useAnularRecuperacion(matriculaId)

  if (query.isLoading) return <div className='card card-body' role='status'>{t('common.loading')}</div>
  if (query.error || !query.data) return <div className='alert alert-danger' role='alert'>{query.error?.message || t('common.error')}</div>
  const {data, candidatos, contexto, can_manage: canManage, meta} = query.data

  return <KTCard>
    <div className='card-header align-items-center gap-3 py-4'>
      <div className='card-title flex-column align-items-start'>
        <h3 className='mb-1'>{t('evaluacion.recuperaciones.title')}</h3>
        {contexto && <span className='text-muted fs-7'>{contexto.estudiante} · {contexto.grado} / {contexto.grupo}</span>}
      </div>
      <div className='card-toolbar'>
        <button type='button' className='btn btn-sm btn-light' onClick={() => navigate(backTo)}>
          {t('evaluacion.planilla.volver')}
        </button>
      </div>
    </div>
    <KTCardBody>
      <p className='text-muted'>{t('evaluacion.recuperaciones.help')}</p>
      {canManage && <section className='mb-8' aria-label={t('evaluacion.recuperaciones.candidates')}>
        <h4 className='fw-semibold mb-4'>{t('evaluacion.recuperaciones.candidates')}</h4>
        {!candidatos.length && <p className='text-muted'>{t('evaluacion.recuperaciones.noCandidates')}</p>}
        <div className='d-flex flex-column gap-3'>
          {candidatos.map(candidate => <div key={`${candidate.asignacion_id}-${candidate.periodo_id ?? 'anual'}`}
            className='border rounded p-4 d-flex flex-wrap gap-3 align-items-center justify-content-between'>
            <div><strong>{candidate.materia}</strong> · {candidate.periodo ?? t('evaluacion.recuperaciones.annual')}
              <div className='text-muted fs-7'>{t('evaluacion.recuperaciones.original')}: {candidate.valor_original}</div>
              {!candidate.puede_abrir && <div className='text-warning fs-7'>{t('evaluacion.recuperaciones.provisional')}</div>}
            </div>
            <button type='button' className='btn btn-sm btn-light-primary' disabled={create.isPending || !candidate.puede_abrir}
              onClick={() => create.mutate(candidate, {
                onSuccess: () => toast.success(t('evaluacion.recuperaciones.opened')),
                onError: error => toast.error(error.message),
              })}>{t('evaluacion.recuperaciones.open')}</button>
          </div>)}
        </div>
      </section>}
      <section aria-label={t('evaluacion.recuperaciones.records')}>
        <h4 className='fw-semibold mb-4'>{t('evaluacion.recuperaciones.records')}</h4>
        {!data.length && <p className='text-muted'>{t('evaluacion.recuperaciones.empty')}</p>}
        <div className='d-flex flex-column gap-4'>
          {data.map(item => <RecoveryRecord key={item.id} item={item} canManage={canManage}
            saving={save.isPending} cancelling={cancel.isPending}
            onSave={(grade, manual, reason) => save.mutate({id: item.id, grade, manual, reason, version: item.version}, {
              onSuccess: () => toast.success(t('evaluacion.recuperaciones.saved')),
              onError: error => toast.error(error.message),
            })}
            onCancel={reason => cancel.mutate({id: item.id, version: item.version, reason}, {
              onSuccess: () => toast.success(t('evaluacion.recuperaciones.cancelled')),
              onError: error => toast.error(error.message),
            })} />)}
        </div>
        {meta.last_page > 1 && <nav className='d-flex align-items-center justify-content-end gap-3 mt-5' aria-label={t('evaluacion.recuperaciones.pages')}>
          <button type='button' className='btn btn-sm btn-light' disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('audit.previous')}</button>
          <span>{page} / {meta.last_page}</span>
          <button type='button' className='btn btn-sm btn-light' disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>{t('audit.next')}</button>
        </nav>}
      </section>
    </KTCardBody>
  </KTCard>
}

const RecoveryRecord = ({item, canManage, saving, cancelling, onSave, onCancel}: {
  item: Recuperacion
  canManage: boolean
  saving: boolean
  cancelling: boolean
  onSave: (grade: string, manual: string, reason: string) => void
  onCancel: (reason: string) => void
}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [grade, setGrade] = useState(item.nota_recuperacion ?? '')
  const [manual, setManual] = useState(item.nota_manual ?? '')
  const [reason, setReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const active = item.estado !== 'anulada'

  return <article className='border rounded p-4'>
    <div className='d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3'>
      <div><strong>{item.materia}</strong> · {item.periodo ?? t('evaluacion.recuperaciones.annual')}
        <div className='text-muted fs-7'>{t('evaluacion.recuperaciones.original')}: {item.valor_original_exacto}
          {item.nota_recuperacion != null && <> · {t('evaluacion.recuperaciones.grade')}: {item.nota_recuperacion}</>}
          {item.valor_efectivo_exacto != null && <> · {t('evaluacion.recuperaciones.effective')}: {item.valor_efectivo_exacto}</>}
        </div>
      </div>
      <span className='badge badge-light-info'>{t(`evaluacion.recuperaciones.status.${item.estado}`)}</span>
    </div>
    <div className='text-muted fs-7 mb-3'>{t('evaluacion.recuperaciones.policy')}: {t(`evaluacion.recuperaciones.policy.${item.politica}`)}</div>
    {item.plan_mejoramiento && <p>{item.plan_mejoramiento}</p>}
    {item.motivo && <p className='text-muted fs-7'>{item.motivo}</p>}
    {item.can_record && active && <>
      <form className='row g-3 align-items-end' onSubmit={event => {event.preventDefault(); onSave(grade, manual, reason)}}>
        <div className='col-12 col-md-2'><label className='form-label' htmlFor={`grade-${item.id}`}>{t('evaluacion.recuperaciones.grade')} <span className='text-danger'>*</span></label>
          <input id={`grade-${item.id}`} className='form-control' type='number' step='0.01' value={grade} required onChange={event => setGrade(event.target.value)} /></div>
        {item.politica === 'MANUAL' && <div className='col-12 col-md-2'><label className='form-label' htmlFor={`manual-${item.id}`}>{t('evaluacion.recuperaciones.manual')} <span className='text-danger'>*</span></label>
          <input id={`manual-${item.id}`} className='form-control' type='number' step='0.01' value={manual} required onChange={event => setManual(event.target.value)} /></div>}
        <div className='col-12 col-md-5'><label className='form-label' htmlFor={`reason-${item.id}`}>{t('evaluacion.recuperaciones.reason')} <span className='text-danger'>*</span></label>
          <input id={`reason-${item.id}`} className='form-control' minLength={3} maxLength={500} value={reason} required onChange={event => setReason(event.target.value)} /></div>
        <div className='col-12 col-md-3'><button type='submit' className='btn btn-sm btn-primary w-100' disabled={saving}>{t('evaluacion.recuperaciones.save')}</button></div>
      </form>
    </>}
    {canManage && active && <details className='mt-4'><summary className='text-danger cursor-pointer'>{t('evaluacion.recuperaciones.cancel')}</summary>
        <form className='d-flex flex-wrap gap-2 mt-3' onSubmit={event => {event.preventDefault(); onCancel(cancelReason)}}>
          <input className='form-control flex-grow-1' style={{maxWidth: 480}} aria-label={t('evaluacion.recuperaciones.cancelReason')}
            placeholder={t('evaluacion.recuperaciones.cancelReason')} minLength={3} maxLength={500}
            value={cancelReason} required onChange={event => setCancelReason(event.target.value)} />
          <button type='submit' className='btn btn-sm btn-light-danger' disabled={cancelling}>{t('evaluacion.recuperaciones.confirmCancel')}</button>
        </form>
      </details>}
  </article>
}
