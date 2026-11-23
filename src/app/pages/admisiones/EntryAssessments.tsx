import {useState, type FormEvent} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useEnrollmentScope} from './enrollmentSettings.api'
import {Field, type GradeContext, type Change, type Decision, type T} from './ExternalGrades'
import {GradeRectification} from './GradeRectification'

type Target = {materia_token: string; periodo_token: string}
type Proposal = {materia: string; periodo: string; valor: string; categoria: string | null; opcion_token: string | null; version_escala: string}
type Assessment = Target & {
  requiere_autorizacion_cierre?: boolean
  token: string; propuesta: Proposal; motivo: string; archivo_token: string; archivo_nombre: string; registrado_por: string; registrado_en: string
  version: number; rectificaciones: Change[]; decision: Omit<Decision, 'materia' | 'periodo'> | null; aprobado_en: string | null
}
type Transfer = Target & {token: string; tiene_equivalencia: boolean; fecha_efectiva: string; definitiva: string | null; motivo: string | null}
type MissingEquivalence = Target & {motivo_sin_equivalencia: string; responsable: string; fecha_seguimiento: string}
type Details = GradeContext & {puede_rectificar: boolean; puede_autorizar_cierre?: boolean; sin_equivalencia?: MissingEquivalence[]; traslados?: Transfer[]; certificados_pendientes?: Target[]; antecedentes: Target[]; valoraciones: Assessment[]}
const matches = (a: Target, b: Target) => a.materia_token === b.materia_token && a.periodo_token === b.periodo_token

function AssessmentForm({data, path, target, arrival, transfer, assessment, t, close, saved}: {
  data: Details; path: string; target: Target; arrival: string; transfer?: Transfer; assessment?: Assessment; t: T; close: () => void; saved: () => void
}) {
  const scale = data.escala!
  const proposal = assessment?.propuesta
  const sameScale = proposal?.version_escala === scale.version
  const mutation = useMutation({mutationFn: (fields: FormData) => assessment
    ? api.post(path + '/' + assessment.token + '/aprobar', Object.fromEntries(fields))
    : api.post(path, fields), onSuccess: saved})
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (mutation.isPending) return
    const fields = new FormData(e.currentTarget)
    fields.set('version_escala', scale.version)
    if (!assessment) {
      if (transfer) fields.set('traslado_token', transfer.token)
      else fields.set('fecha_ingreso', arrival)
      fields.set('materia_token', target.materia_token)
      fields.set('periodo_token', target.periodo_token)
    }
    mutation.mutate(fields)
  }
  return <form onSubmit={submit} className='border-top pt-3 mt-3'>
    <fieldset disabled={mutation.isPending}>
      <div className='row g-3'>
        <Field label={t('Definitiva', 'Final grade') + ' · ' + scale.nombre}>{scale.opciones.length
          ? <select className='form-select' name='opcion_token' defaultValue={(sameScale && proposal?.opcion_token) || ''} required>
            <option value=''>{t('Selecciona', 'Select')}</option>{scale.opciones.map(o => <option key={o.token} value={o.token}>{o.nombre}</option>)}
          </select>
          : <input className='form-control' name='valor' type='number' min={scale.minimo} max={scale.maximo} step={10 ** -scale.decimales}
            defaultValue={sameScale ? proposal?.valor : ''} required/>}</Field>
        {!assessment && <Field label={t('Soporte de la valoración (PDF, JPG o PNG)', 'Assessment evidence (PDF, JPG or PNG)')}>
          <input className='form-control' type='file' name='soporte' accept='.pdf,.png,.jpg,.jpeg' required onChange={e => {
            const file = e.target.files?.[0]
            e.target.setCustomValidity(file && file.size > data.max_bytes ? t('El archivo supera el tamaño permitido.', 'File exceeds the upload limit.') : '')
          }}/></Field>}
      </div>
      {assessment && !sameScale && <p className='text-warning mt-3'>{t('La escala cambió. Revisa el soporte y selecciona la definitiva vigente.', 'The scale changed. Review the evidence and select the final grade.')}</p>}
      <label className='form-label d-block mt-3'>{assessment ? t('Motivo de la aprobación', 'Reason for approval') : t('Motivo y competencias valoradas', 'Reason and skills assessed')}
        <textarea name={assessment ? 'criterio' : 'motivo'} className='form-control mt-1' maxLength={1500} required/></label>
      {mutation.error && <p role='alert' className='text-danger'>{mutation.error.message}</p>}
      <div className='d-flex gap-2'><button className='btn btn-sm btn-primary' type='submit'>{assessment ? t('Aprobar valoración', 'Approve assessment') : t('Guardar para revisión', 'Save for review')}</button>
        <button className='btn btn-sm btn-light' type='button' onClick={close}>{t('Cancelar', 'Cancel')}</button></div>
    </fieldset>
  </form>
}

export function EntryAssessments({token, hasTransfer}: {token: string; hasTransfer?: boolean}) {
  const en = useIntl().locale.startsWith('en')
  const t: T = (es, english) => en ? english : es
  const cache = useQueryClient()
  const scope = useEnrollmentScope()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [subject, setSubject] = useState('')
  const [editing, setEditing] = useState('')
  const path = '/matriculas/' + encodeURIComponent(token) + '/valoraciones-ingreso'
  const query = useQuery({queryKey: ['matriculas', scope, 'valoraciones-ingreso', token], enabled: open, queryFn: () => api.get<Details>(path)})
  const data = query.data
  const [mode, setMode] = useState<'ingreso' | 'traslado'>()
  const transfers = data?.traslados ?? []
  const placement = transfers.length > 0 && mode !== 'ingreso'
  const arrival = data?.fecha_ingreso || date
  const incoming = data?.periodos.find(p => p.desde <= arrival && p.hasta >= arrival && arrival <= data.hoy)
  const subjects = data?.materias.filter(m => !placement || transfers.some(r => r.materia_token === m.token)) ?? []
  const selected = subjects.find(m => m.token === subject)?.token ?? subjects[0]?.token ?? ''
  const periods = placement ? data!.periodos.filter(p => transfers.some(r => r.materia_token === selected && r.periodo_token === p.token))
    : incoming ? data!.periodos.filter(p => p.hasta < arrival) : []
  const refresh = async (approved: boolean) => {
    await Promise.all([query.refetch(), cache.invalidateQueries({queryKey: ['matriculas', scope, 'definitivas-externas', token]}),
      ...(approved ? ['evaluacion', 'boletines', 'anos-lectivos'].map(key => cache.invalidateQueries({queryKey: [key]})) : [])])
  }
  return <section className='border-top mt-5 pt-4'>
    <button type='button' className='btn btn-light-primary' aria-expanded={open} onClick={() => setOpen(!open)}>{t('Valoraciones de ingreso', 'Entry assessments')}{hasTransfer && t(' y cambio de grado', ' and grade changes')}</button>
    {open && <div className='mt-3'>
      {query.isPending && <p role='status'>{t('Cargando…', 'Loading…')}</p>}
      {query.error && <p role='alert'>{query.error.message}</p>}
      {data && <>
        {transfers.length > 0 && <div className='d-flex flex-wrap gap-2 mb-3'>
          {(['traslado', 'ingreso'] as const).map(kind => <button key={kind} type='button' aria-pressed={placement === (kind === 'traslado')}
            className={'btn btn-sm ' + (placement === (kind === 'traslado') ? 'btn-primary' : 'btn-light')}
            onClick={() => {setMode(kind); setEditing('')}}>{kind === 'traslado' ? t('Cambio de grado', 'Grade change') : t('Ingreso al colegio', 'School entry')}</button>)}
        </div>}
        {placement ? <p>{t('Cambio de grado con fecha efectiva', 'Grade change effective on')} · {transfers[0].fecha_efectiva}</p> : <p>{t('Los periodos anteriores al ingreso quedan pendientes hasta que el colegio apruebe una valoración o reconozca un certificado.', 'Periods before entry remain pending until the school approves an assessment or recognizes a certificate.')}</p>}
        <div className='row g-3'>
          {!placement && <Field label={t('Fecha de ingreso al colegio', 'School entry date')}><input className='form-control' type='date' name='fecha_ingreso_valoracion' value={arrival} max={data.hoy}
            readOnly={!!data.fecha_ingreso} onChange={e => {setDate(e.target.value); setEditing('')}}/></Field>}
          <Field label={t('Materia', 'Subject')}><select className='form-select' name='materia_valoracion' value={selected} onChange={e => {setSubject(e.target.value); setEditing('')}}>
            {subjects.map(m => <option key={m.token} value={m.token}>{m.nombre}</option>)}</select></Field>
        </div>
        {data.error_escala && <p className='text-warning mt-3'>{data.error_escala}</p>}
        {!placement && arrival && !incoming && <p role='status'>{t('Selecciona una fecha del año lectivo hasta hoy.', 'Select a date in this school year through today.')}</p>}
        {!placement && incoming && <p className='mt-3'>{t('Periodo de ingreso', 'Entry period')} · {incoming.nombre}</p>}
        {!placement && incoming && !periods.length && <p>{t('No hay periodos anteriores al ingreso.', 'There are no earlier periods.')}</p>}
        {!selected && <p>{t('Configura las materias del grado en el currículo.', 'Configure subjects for this grade in the curriculum.')}</p>}
        {selected && periods.map(period => {
          const target = {materia_token: selected, periodo_token: period.token}
          const assessment = data.valoraciones.find(r => matches(r, target))
          const slot = transfers.find(r => matches(r, target))
          const transfer = placement ? slot : undefined
          const previous = transfer ? transfer.definitiva !== null || transfer.tiene_equivalencia : data.antecedentes.some(r => matches(r, target))
          const pendingCertificate = data.certificados_pendientes?.some(r => matches(r, target))
          const gap = data.sin_equivalencia?.find(r => matches(r, target))
          const canAct = !pendingCertificate && (placement || !slot) && data.escala && !previous && !assessment?.decision && (assessment ? data.puede_aprobar : data.puede_registrar)
          const status = pendingCertificate ? t('Certificado en trámite', 'Awaiting certificate') : assessment?.decision ? t('Valoración aprobada', 'Approved assessment') : transfer?.definitiva != null
            ? t('Definitiva del grado anterior', 'Previous grade final') + ' · ' + transfer.definitiva : previous ? t('Con notas registradas', 'Prior grades recorded')
            : assessment ? t('Pendiente de aprobación', 'Awaiting approval') : t('Pendiente de valoración', 'Pending assessment')
          return <article key={period.token} className='border rounded p-4 mt-3'>
            <div className='d-flex flex-wrap align-items-center justify-content-between gap-2'><strong>{period.nombre} · {status}</strong>
              {canAct && editing !== period.token && <button type='button' className='btn btn-sm btn-light-primary' onClick={() => setEditing(period.token)}>
                {assessment ? t('Revisar valoración', 'Review assessment') : t('Registrar valoración', 'Register assessment')}</button>}</div>
            {gap && <p className='mt-2 mb-1'>{t('Sin equivalencia', 'No equivalence')} · {gap.motivo_sin_equivalencia}<br/>
              <small>{t('Seguimiento', 'Follow-up')} · {gap.responsable} · {gap.fecha_seguimiento}</small></p>}
            {transfer?.motivo && !assessment && <p className='mb-0 mt-2'>{transfer.motivo}</p>}
            {assessment && <div className='mt-2 text-break'>
              <p className='mb-1'>{t('Propuesta', 'Proposed grade')} · {assessment.propuesta.categoria ?? assessment.propuesta.valor} · {assessment.registrado_por} · {assessment.registrado_en.slice(0,10)}</p>
              <p className='mb-1'>{assessment.motivo}</p>
              <a href={'/api' + path + '/soportes/' + assessment.archivo_token} download>{assessment.archivo_nombre}</a>
              {assessment.decision && <p className='mt-2 mb-0'>{t('Definitiva aprobada', 'Approved final grade')} · {assessment.decision.categoria ?? assessment.decision.valor} · {assessment.decision.responsable} · {assessment.aprobado_en?.slice(0,10)}<br/>{assessment.decision.criterio}</p>}
            </div>}
            {assessment?.decision && <GradeRectification key={assessment.token} label={t('Rectificar valoración', 'Correct assessment')}
              result={{...assessment, decision: {...assessment.decision, materia: assessment.propuesta.materia, periodo: period.nombre}}}
              allowed={data.puede_rectificar && !assessment.requiere_autorizacion_cierre} path={path} maxBytes={data.max_bytes} refresh={() => refresh(true)} t={t}/>}
            {canAct && editing === period.token && <AssessmentForm data={data} path={path} target={target} arrival={arrival} transfer={transfer} assessment={assessment} t={t}
              close={() => setEditing('')} saved={() => {
                setEditing('')
                toast.success(assessment ? t('Valoración aprobada.', 'Assessment approved.') : t('Valoración registrada para revisión.', 'Assessment submitted for review.'), 'updated')
                void refresh(!!assessment)
              }}/>}
          </article>
        })}
      </>}
    </div>}
  </section>
}
