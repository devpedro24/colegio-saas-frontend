import {useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useEnrollmentScope} from './enrollmentSettings.api'
import type {T} from './ExternalGrades'

type Support = {fecha_entrega: string; motivo: string; responsable: string}
type Candidate = {actividad_token: string; nombre: string; fecha: string}
type Proposal = {definitiva: string; sin_apoyos?: string | null}
type Evidence = {apoyo?: Support; nombre: string; fecha: string | null; valor: string | null; peso: string | null; componentes: {nombre: string; peso: string | null}[]}
type Segment = {grupo: string; desde: string; hasta: string; subtotal: string | null; evidencias: Evidence[]}
type Case = {actividades_disponibles: Candidate[]; token: string; materia: string; periodo: string; version: string; tramos: Segment[];
  aprobacion: null | {definitiva: string; pesos: string[]; motivo: string; responsable: string; fecha: string}}
type Details = {casos: Case[]; puede_asignar_apoyo: boolean; puede_aprobar: boolean}

function SupportForm({item, path, refresh, t}: {item: Case; path: string; refresh: () => Promise<void>; t: T}) {
  const [open, setOpen] = useState(false)
  const [activity, setActivity] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const toast = useToast()
  const destination = item.tramos[item.tramos.length - 1]
  const assign = useMutation({mutationFn: () => api.post(path + '/' + item.token + '/apoyos',
    {actividad_token: activity, fecha_entrega: date, motivo: reason.trim()}),
    onSuccess: async () => {
      toast.success(t('Actividad de apoyo asignada.', 'Support activity assigned.'), 'success')
      await refresh()
    }})
  if (!open) return <button type='button' className='btn btn-sm btn-light-primary mt-3' onClick={() => setOpen(true)}>
    {t('Asignar actividad de apoyo', 'Assign support activity')}</button>
  return <fieldset className='mt-3 border rounded p-3' disabled={assign.isPending}>
    <legend className='fs-6 fw-semibold'>{t('Apoyo individual', 'Individual support')} · {destination.grupo}</legend>
    <label className='form-label d-block'>{t('Actividad anterior al traslado', 'Activity before the transfer')}
      <select name='actividad_apoyo' className='form-select form-select-sm' value={activity} onChange={e => setActivity(e.target.value)}>
        <option value=''>{t('Selecciona una actividad', 'Choose an activity')}</option>
        {item.actividades_disponibles.map(a => <option key={a.actividad_token} value={a.actividad_token}>{a.nombre} · {a.fecha}</option>)}
      </select></label>
    <label className='form-label d-block'>{t('Fecha de entrega', 'Due date')}
      <input name='entrega_apoyo' type='date' min={destination.desde} className='form-control form-control-sm'
        value={date} onChange={e => setDate(e.target.value)}/></label>
    <label className='form-label d-block'>{t('Motivo del apoyo', 'Reason for support')}
      <textarea name='motivo_apoyo' className='form-control form-control-sm' rows={2} maxLength={1500}
        value={reason} onChange={e => setReason(e.target.value)}/></label>
    <div className='d-flex gap-2'>
      <button type='button' className='btn btn-sm btn-primary' disabled={!activity || !date || date < destination.desde || !reason.trim()}
        onClick={() => assign.mutate()}>{t('Asignar apoyo', 'Assign support')}</button>
      <button type='button' className='btn btn-sm btn-light' onClick={() => setOpen(false)}>{t('Cancelar', 'Cancel')}</button>
    </div>
    {assign.error && <p className='mt-2 mb-0 text-danger' role='alert'>{assign.error.message}</p>}
  </fieldset>
}

function PeriodReview({item, path, canApprove, canAssign, refresh, t}: {item: Case; path: string; canApprove: boolean; canAssign: boolean; refresh: () => Promise<void>; t: T}) {
  const [weights, setWeights] = useState<string[]>(() => item.tramos.map(() => ''))
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<Proposal | null>(null)
  const toast = useToast()
  const approved = item.aprobacion
  const ready = item.tramos.every((s, i) => s.subtotal !== null && Number(weights[i]) > 0) &&
    weights.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0) === 10000
  const mutation = useMutation({mutationFn: async (action: 'propuesta' | 'aprobar') => {
    const payload = {version: item.version, pesos: weights}
    if (action === 'propuesta') {
      const proposal = await api.post<Proposal>(path + '/' + item.token + '/propuesta', payload)
      setPreview(proposal)
    } else {
      await api.post(path + '/' + item.token + '/aprobar', {...payload, motivo: reason.trim()})
      toast.success(t('Definitiva consolidada.', 'Final grade approved.'), 'updated')
      await refresh()
    }
  }, onError: async error => {
    setPreview(null)
    if (error instanceof ApiError && error.status === 409) await refresh()
  }})
  return <article className='border rounded p-4 mt-3'>
    <h5>{item.materia} · {item.periodo}</h5>
    <div className='row g-3'>{item.tramos.map((span, i) => <div className='col-12 col-lg-6' key={span.desde}>
      <div className='bg-light rounded p-3 h-100'><strong>{span.grupo}</strong>
        <small className='d-block text-muted'>{span.desde} — {span.hasta}</small>
        <ul className='list-unstyled mt-2'>{span.evidencias.map((activity, index) => <li className='mb-2' key={index}>
          {activity.nombre} · <strong>{activity.valor ?? t('Pendiente', 'Pending')}</strong>{activity.peso != null && ' · ' + activity.peso + ' %'}
          {activity.apoyo && <small className='d-block text-primary'>
            {activity.valor === null ? t('Pendiente de apoyo', 'Support work pending') : t('Apoyo calificado', 'Support work graded')}
            {' · '}{t('Entrega', 'Due')} {activity.apoyo.fecha_entrega}<br/>{activity.apoyo.motivo} · {activity.apoyo.responsable}
          </small>}
          <small className='d-block text-muted'>{[activity.fecha, ...activity.componentes.map(c => c.nombre + (c.peso == null ? '' : ' · ' + c.peso + ' %'))].filter(Boolean).join(' · ')}</small>
        </li>)}</ul>
        <div>{t('Subtotal del tramo', 'Segment subtotal')} · <strong>{span.subtotal ?? t('Pendiente', 'Pending')}</strong></div>
        {approved ? <small>{t('Aporte al periodo', 'Share of term')} · {approved.pesos[i]} %</small> : canApprove &&
          <label className='form-label d-block mt-3'>{t('Aporte al periodo (%)', 'Share of term (%)')} · {span.grupo}
            <input className='form-control form-control-sm mt-1' type='number' name={'peso_tramo_' + i} min='0.01' max='99.99' step='0.01' disabled={mutation.isPending}
              value={weights[i]} onChange={e => {setPreview(null); setWeights(weights.map((w, n) => i === n ? e.target.value : w))}}/></label>}
        {canAssign && !approved && i === item.tramos.length - 1 && item.actividades_disponibles?.length > 0 &&
          <SupportForm item={item} path={path} refresh={refresh} t={t}/>}
      </div></div>)}</div>
    {approved ? <p className='mt-3 mb-0'><strong>{t('Definitiva aprobada', 'Approved final grade')} · {approved.definitiva}</strong>
      <br/>{approved.responsable} · {approved.fecha.slice(0, 10)}<br/>{approved.motivo}</p> : <>
      <p className='mt-3'>{item.tramos.some(s => s.subtotal === null)
        ? t('Falta evidencia para calcular un tramo. Revisa las notas y los porcentajes de sus actividades.', 'A segment needs evidence. Review its grades and activity weights.')
        : t('Pendiente de consolidar. Los aportes de los tramos deben sumar 100 %.', 'Pending consolidation. Segment shares must total 100%.')}</p>
      {canApprove && <><button type='button' className='btn btn-sm btn-light-primary' disabled={!ready || mutation.isPending}
        onClick={() => mutation.mutate('propuesta')}>{t('Calcular propuesta', 'Calculate proposed grade')}</button>
        {preview !== null && <div className='mt-3'><strong>{t('Definitiva propuesta', 'Proposed final grade')} · {preview.definitiva}</strong>
          {preview.sin_apoyos !== undefined && <small className='d-block text-muted'>
            {t('Propuesta sin actividades de apoyo', 'Proposal without support activities')} · {preview.sin_apoyos ?? t('Pendiente', 'Pending')}
          </small>}
          <label className='d-block form-label mt-3'>{t('Criterio de ponderación', 'Reason for weighting')}
            <textarea className='form-control' name='criterio_consolidacion' rows={2} maxLength={1500} value={reason} onChange={e => setReason(e.target.value)}/></label>
          <button type='button' className='btn btn-sm btn-primary' disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate('aprobar')}>{t('Aprobar definitiva', 'Approve final grade')}</button></div>}</>}
    </>}
    {mutation.error && <p className='text-danger mt-2' role='alert'>{mutation.error.message}</p>}
  </article>
}

export function SplitPeriodGrades({token}: {token: string}) {
  const en = useIntl().locale.startsWith('en')
  const t: T = (es, english) => en ? english : es
  const scope = useEnrollmentScope()
  const cache = useQueryClient()
  const [open, setOpen] = useState(false)
  const path = '/matriculas/' + encodeURIComponent(token) + '/consolidaciones'
  const query = useQuery({enabled: open, queryKey: ['matriculas', scope, 'consolidaciones', token], queryFn: () => api.get<Details>(path)})
  const refresh = async () => {await Promise.all([query.refetch(), ...['evaluacion', 'boletines', 'anos-lectivos'].map(k => cache.invalidateQueries({queryKey: [k]}))])}
  return <section className='border-top mt-4 pt-4'><button type='button' aria-expanded={open} className='btn btn-light-primary'
    onClick={() => setOpen(!open)}>{t('Consolidar periodo por cambio de grupo', 'Consolidate a term after a group change')}</button>
    {open && <>{query.isPending && <p role='status'>{t('Cargando…', 'Loading…')}</p>}
      {query.error && <p role='alert'>{query.error.message}</p>}
      {query.data?.casos.map(item => <PeriodReview key={item.token + item.version} item={item} canApprove={query.data.puede_aprobar} canAssign={query.data.puede_asignar_apoyo} t={t} path={path} refresh={refresh}/>)}</>}
  </section>
}
