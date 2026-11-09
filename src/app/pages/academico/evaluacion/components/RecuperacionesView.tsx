import {NumberInput} from '@/app/shared/components/NumberInput'
import {useState, type ReactNode} from 'react'
import {useNavigate, useParams, useSearchParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useWorkDraft} from '@/lib/drafts/WorkDrafts'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'
import {
  Recuperacion, useAnularRecuperacion, useCrearRecuperacion,
  useRecuperaciones, useRegistrarRecuperacion, type RecoveryInput, type RecoveryPeriod, type RecoveryResult,
} from '../recuperaciones.api'
import {VisualChoice} from './VisualChoice'
import {gradeDisplay} from '../gradeDisplay'
import type {EscalaOpcion} from '../../configuracion/configuracion.types'

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

  if (query.isLoading) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
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
        <RecoveryPeriodGroups items={candidatos} renderItem={candidate => <div key={`${candidate.asignacion_id}-${candidate.periodo_id ?? 'anual'}`}
            className='border rounded p-4 d-flex flex-wrap gap-3 align-items-center justify-content-between'>
            <div><strong>{candidate.materia}</strong>
              <div className='d-flex align-items-center gap-2 text-muted fs-7 mt-2'>
                {t(candidate.valoracion_original ? 'evaluacion.recuperaciones.originalVisual' : 'evaluacion.recuperaciones.original')}:
                {candidate.valoracion_original ? <VisualChoice choice={candidate.valoracion_original} /> : gradeDisplay(candidate.valor_original)}
              </div>
              {!candidate.puede_abrir && <div className='text-warning fs-7'>{t('evaluacion.recuperaciones.provisional')}</div>}
            </div>
            <button type='button' className='btn btn-sm btn-light-primary' disabled={create.isPending || !candidate.puede_abrir}
              onClick={() => create.mutate(candidate, {
                onSuccess: () => toast.success(t('evaluacion.recuperaciones.opened')),
                onError: error => toast.error(error.message),
              })}>{t('evaluacion.recuperaciones.open')}</button>
          </div>} />
      </section>}
      <section aria-label={t('evaluacion.recuperaciones.records')}>
        <h4 className='fw-semibold mb-4'>{t('evaluacion.recuperaciones.records')}</h4>
        {!data.length && <p className='text-muted'>{t('evaluacion.recuperaciones.empty')}</p>}
        <RecoveryPeriodGroups items={data} renderItem={item => <RecoveryRecord key={`${item.id}-${item.version}`} item={item} canManage={canManage}
            saving={save.isPending} cancelling={cancel.isPending}
            onSave={input => save.mutateAsync({id: item.id, ...input, version: item.version}, {
              onSuccess: () => toast.success(t('evaluacion.recuperaciones.saved')),
              onError: error => toast.error(error.message),
            })}
            onCancel={reason => cancel.mutate({id: item.id, version: item.version, reason}, {
              onSuccess: () => toast.success(t('evaluacion.recuperaciones.cancelled')),
              onError: error => toast.error(error.message),
            })} />} />
        {meta.last_page > 1 && <nav className='d-flex align-items-center justify-content-end gap-3 mt-5' aria-label={t('evaluacion.recuperaciones.pages')}>
          <button type='button' className='btn btn-sm btn-light' disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('audit.previous')}</button>
          <span>{page} / {meta.last_page}</span>
          <button type='button' className='btn btn-sm btn-light' disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>{t('audit.next')}</button>
        </nav>}
      </section>
    </KTCardBody>
  </KTCard>
}

export function RecoveryPeriodGroups<T extends RecoveryPeriod>({items, renderItem}: {items: T[]; renderItem: (item: T) => ReactNode}) {
  const intl = useIntl()
  const groups = new Map<string, {period: T; items: T[]}>()
  for (const item of [...items].sort((a, b) => (a.periodo_orden ?? Number.MAX_SAFE_INTEGER) - (b.periodo_orden ?? Number.MAX_SAFE_INTEGER))) {
    const key = item.periodo_id ?? 'annual'
    const group = groups.get(key) ?? {period: item, items: []}
    group.items.push(item)
    groups.set(key, group)
  }
  return <div className='d-flex flex-column gap-6'>{[...groups].map(([key, {period, items: rows}]) =>
    <section key={key}>
      <div className='d-flex align-items-center gap-3 bg-light rounded p-3 mb-3'>
        <h5 className='mb-0'>{period.periodo ?? intl.formatMessage({id: 'evaluacion.recuperaciones.annual'})}</h5>
        {period.periodo_estado && <span className={`badge badge-light-${period.periodo_estado === 'abierto' ? 'primary' : 'warning'}`}>
          {intl.formatMessage({id: `evaluacion.recuperaciones.period.${period.periodo_estado}`})}
        </span>}
      </div>
      <div className='d-flex flex-column gap-3'>{rows.map(renderItem)}</div>
    </section>)}</div>
}

export const RecoveryRecord = ({item, canManage, saving, cancelling, onSave, onCancel}: {
  item: Recuperacion
  canManage: boolean
  saving: boolean
  cancelling: boolean
  onSave: (input: RecoveryInput) => Promise<unknown>
  onCancel: (reason: string) => void
}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [grade, setGrade] = useState(item.resultado_recuperacion?.display_value ?? '')
  const [manual, setManual] = useState(item.resultado_manual?.display_value ?? '')
  const [choice, setChoice] = useState(item.resultado_recuperacion?.valoracion?.url_token ?? '')
  const [manualChoice, setManualChoice] = useState(item.resultado_manual?.valoracion?.url_token ?? '')
  const [reason, setReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const active = item.estado !== 'anulada'
  const visual = item.escala_visual.tipo === 'imagenes'
  const options = item.escala_visual.opciones
  const recovery = useWorkDraft({context: `recovery:${item.id}`, title: `${item.materia} · ${item.periodo ?? t('evaluacion.recuperaciones.annual')}`,
    value: {grade, manual, choice, manualChoice, reason}, base: String(item.version), enabled: item.can_record && active,
    dirty: !!reason || grade !== (item.resultado_recuperacion?.display_value ?? '') || manual !== (item.resultado_manual?.display_value ?? '')
      || choice !== (item.resultado_recuperacion?.valoracion?.url_token ?? '') || manualChoice !== (item.resultado_manual?.valoracion?.url_token ?? ''),
    restore: value => {setGrade(value.grade); setManual(value.manual); setChoice(value.choice); setManualChoice(value.manualChoice); setReason(value.reason)},
    reset: () => {setGrade(item.resultado_recuperacion?.display_value ?? ''); setManual(item.resultado_manual?.display_value ?? '');
      setChoice(item.resultado_recuperacion?.valoracion?.url_token ?? ''); setManualChoice(item.resultado_manual?.valoracion?.url_token ?? ''); setReason('')}})

  return <article className='border rounded p-4'>
    {recovery.notice}
    <div className='d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3'>
      <strong>{item.materia}</strong>
      <span className={`badge badge-light-${item.estado === 'aprobada' ? 'primary' : item.estado === 'no_aprobada' || item.estado === 'anulada' ? 'danger' : 'warning'}`}>
        {t(`evaluacion.recuperaciones.status.${item.estado}`)}</span>
    </div>
    <div className='d-flex flex-wrap gap-6 mb-4'>
      <RecoveryResultValue label={t(visual ? 'evaluacion.recuperaciones.originalVisual' : 'evaluacion.recuperaciones.original')} result={item.resultado_original} />
      {item.resultado_recuperacion && <RecoveryResultValue label={t(visual ? 'evaluacion.recuperaciones.gradeVisual' : 'evaluacion.recuperaciones.grade')} result={item.resultado_recuperacion} />}
      {item.resultado_efectivo && <RecoveryResultValue label={t('evaluacion.recuperaciones.effective')} result={item.resultado_efectivo} />}
    </div>
    <div className='text-muted fs-7 mb-3'>{t('evaluacion.recuperaciones.policy')}: {t(`evaluacion.recuperaciones.policy.${item.politica}`)}</div>
    {item.plan_mejoramiento && <p>{item.plan_mejoramiento}</p>}
    {item.motivo && <p className='text-muted fs-7'>{item.motivo}</p>}
    {active && item.motivo_bloqueo && <div className='alert alert-warning' role='status'>{item.motivo_bloqueo}</div>}
    {item.can_record && active && <>
      <form className='row g-3 align-items-end' onSubmit={event => {event.preventDefault(); const finishDraft = recovery.afterSave();
        void onSave({grade: visual ? '' : grade, manual: visual ? '' : manual, reason, choice: visual ? choice : undefined, manualChoice: visual && item.politica === 'MANUAL' ? manualChoice : undefined}).then(() => finishDraft()).catch(() => {})}}>
        <div className='col-12 col-md-3'><label className='form-label' htmlFor={`grade-${item.id}`}>{t(visual ? 'evaluacion.recuperaciones.gradeVisual' : 'evaluacion.recuperaciones.grade')} <span className='text-danger'>*</span></label>
          {visual ? <RecoveryChoiceInput id={`grade-${item.id}`} value={choice} onChange={setChoice} options={options} />
            : <NumberInput id={`grade-${item.id}`} className='form-control' type='number' step='0.1' value={grade} required onChange={event => setGrade(event.target.value)} />}</div>
        {item.politica === 'MANUAL' && <div className='col-12 col-md-2'><label className='form-label' htmlFor={`manual-${item.id}`}>{t('evaluacion.recuperaciones.manual')} <span className='text-danger'>*</span></label>
          {visual ? <RecoveryChoiceInput id={`manual-${item.id}`} value={manualChoice} onChange={setManualChoice} options={options} />
            : <NumberInput id={`manual-${item.id}`} className='form-control' type='number' step='0.1' value={manual} required onChange={event => setManual(event.target.value)} />}</div>}
        <div className='col-12 col-md-5'><label className='form-label' htmlFor={`reason-${item.id}`}>{t('evaluacion.recuperaciones.reason')} <span className='text-danger'>*</span></label>
          <input id={`reason-${item.id}`} className='form-control' minLength={3} maxLength={500} value={reason} required onChange={event => setReason(event.target.value)} /></div>
        <div className='col-12 col-md-3'><button type='submit' className='btn btn-sm btn-primary w-100' disabled={saving}>{t('evaluacion.recuperaciones.save')}</button></div>
      </form>
    </>}
    {canManage && item.can_cancel && active && <details className='mt-4'><summary className='text-danger cursor-pointer'>{t('evaluacion.recuperaciones.cancel')}</summary>
        <form className='d-flex flex-wrap gap-2 mt-3' onSubmit={event => {event.preventDefault(); onCancel(cancelReason)}}>
          <input className='form-control flex-grow-1' style={{maxWidth: 480}} aria-label={t('evaluacion.recuperaciones.cancelReason')}
            placeholder={t('evaluacion.recuperaciones.cancelReason')} minLength={3} maxLength={500}
            value={cancelReason} required onChange={event => setCancelReason(event.target.value)} />
          <button type='submit' className='btn btn-sm btn-light-danger' disabled={cancelling}>{t('evaluacion.recuperaciones.confirmCancel')}</button>
        </form>
      </details>}
  </article>
}

function RecoveryResultValue({label, result}: {label: string; result: RecoveryResult}) {
  return <div><div className='text-muted fs-7 mb-1'>{label}</div>
    {result.valoracion ? <VisualChoice choice={result.valoracion} /> : <span className='fw-semibold'>{gradeDisplay(result.display_value)}</span>}
  </div>
}

function RecoveryChoiceInput({id, value, onChange, options}: {id: string; value: string; onChange: (value: string) => void; options: EscalaOpcion[]}) {
  const intl = useIntl()
  return <>
    <div className='mb-2'><VisualChoice choice={options.find(option => option.url_token === value)} /></div>
    <select id={id} className='form-select' value={value} required onChange={event => onChange(event.target.value)}>
      <option value=''>{intl.formatMessage({id: 'evaluacion.recuperaciones.selectChoice'})}</option>
      {options.map(option => <option key={option.url_token} value={option.url_token}>{option.emoji} {option.nombre}</option>)}
    </select>
  </>
}
