import {useRef, useState, type FormEvent, type ReactNode} from 'react'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {GradeSourceChoice, type SourceComparison} from './GradeSourceChoice'
import {GradeRectification} from './GradeRectification'
import {useEnrollmentScope} from './enrollmentSettings.api'

type Option = {token: string; nombre: string}
type Period = Option & {desde: string; hasta: string}
type Scale = {version: string; nombre: string; minimo: string; maximo: string; decimales: number; opciones: Option[]}
export type Decision = {materia: string; periodo: string; valor: string; categoria: string | null; criterio: string; responsable: string; siee: Scale}
export type Change = {version: number; anterior: Pick<Decision, 'valor' | 'categoria' | 'responsable' | 'criterio'>; nueva: Pick<Decision, 'valor' | 'categoria' | 'responsable'>;
  aprobacion_anterior: string; registrado_en: string; motivo: string; archivo_token: string; archivo_nombre: string}
export type Result = {eleccion?: SourceComparison | null; version: number; rectificaciones: Change[]; token: string; materia_token: string | null; periodo_token: string | null; materia_origen: string; periodo_origen: string; desde: string; hasta: string; valor_original: string; decision: Decision | null; aprobado_en: string | null}
type Certificate = {archivo_token: string; archivo_nombre: string; colegio_origen: string; grado_origen: string; escala_origen: string; fecha_ingreso: string; periodo_ingreso: string; registrado_por: string; registrado_en: string; resultados: Result[]}
export type GradeContext = {fecha_ingreso: string | null; puede_registrar: boolean; puede_aprobar: boolean; escala: Scale | null; error_escala: string | null; hoy: string; max_bytes: number; materias: Option[]; periodos: Period[]}
type Pending = {token: string; materia_token: string; periodo_token: string; materia: string; periodo: string; responsable: string;
  certificado_revisado: string | null; motivo_sin_equivalencia: string | null; valoracion_token: string | null;
  fecha_seguimiento: string; resultado_token: string | null; aprobado_en: string | null; aprobado_por: string | null}
type Details = GradeContext & {puede_elegir: boolean; puede_rectificar: boolean; certificados: Certificate[]; pendientes: Pending[]; responsables: Option[]; responsables_valoracion: Option[]}
export type T = (es: string, en: string) => string

export function Field({label, children}: {label: string; children: ReactNode}) {
  return <label className='col-sm-6 col-xl-4 d-flex flex-column gap-1 form-label mb-0'><span>{label}</span>{children}</label>
}

function PendingForm({data, path, t, saved, cancel, certificate}: {data: Details; certificate?: Certificate; path: string; t: T; saved: () => void; cancel: () => void}) {
  const [arrival, setArrival] = useState(certificate?.fecha_ingreso ?? data.fecha_ingreso ?? '')
  const owners = certificate ? data.responsables_valoracion : data.responsables
  const [subject, setSubject] = useState('')
  const incoming = data.periodos.find(p => p.desde <= arrival && arrival <= p.hasta)
  const periods = incoming && subject ? data.periodos.filter(p => p.hasta < arrival &&
    !data.pendientes.some(row => row.materia_token === subject && row.periodo_token === p.token && (!certificate || row.certificado_revisado || row.resultado_token))
    && !data.certificados.some(c => c.resultados.some(r => r.materia_token === subject && r.periodo_token === p.token))) : []
  const save = useMutation({mutationFn: (fields: FormData) => api.post(certificate ? path + '/certificados/' + certificate.archivo_token + '/sin-equivalencia' : path + '/pendientes', {
    ...(certificate ? {motivo: fields.get('motivo')} : {fecha_ingreso: arrival}), materia_token: subject, periodos: fields.getAll('periodos'), responsable_token: fields.get('responsable_token'),
    fecha_seguimiento: fields.get('fecha_seguimiento')}), onSuccess: saved})
  const [selected, setSelected] = useState<string[]>([])
  return <form className='mt-3 border rounded p-4' onSubmit={e => {e.preventDefault()
    if (!save.isPending && selected.length) save.mutate(new FormData(e.currentTarget))}}>
    <fieldset disabled={save.isPending}><legend className='fs-5'>{certificate ? t('Materia sin equivalencia', 'Subject without equivalence') : t('Certificado en trámite', 'Awaiting certificate')}</legend>
      <div className='row g-3'>
        <Field label={t('Fecha de ingreso al colegio', 'School entry date')}><input type='date' name='ingreso_pendiente' className='form-control'
          value={arrival} readOnly={!!certificate || !!data.fecha_ingreso} max={data.hoy} required onChange={e => {setArrival(e.target.value); setSelected([])}}/></Field>
        <Field label={t('Materia', 'Subject')}><select className='form-select' name='materia_pendiente' value={subject} required onChange={e => {setSubject(e.target.value); setSelected([])}}>
          <option value=''>{t('Selecciona', 'Select')}</option>{data.materias.map(o => <option value={o.token} key={o.token}>{o.nombre}</option>)}</select></Field>
        <Field label={t('Responsable del seguimiento', 'Follow-up owner')}><select name='responsable_token' className='form-select' required defaultValue={owners.length === 1 ? owners[0].token : ''}>
          <option value=''>{t('Selecciona', 'Select')}</option>{owners.map(o => <option value={o.token} key={o.token}>{o.nombre}</option>)}</select></Field>
        <Field label={t('Fecha de seguimiento', 'Follow-up date')}><input name='fecha_seguimiento' type='date' className='form-control' required min={arrival || undefined}/></Field>
      </div>
      {certificate && <label className='form-label d-block mt-3'>{t('Motivo de la falta de equivalencia', 'Reason there is no equivalence')}
        <textarea name='motivo' className='form-control' required maxLength={1500}/></label>}
      {arrival && !incoming && <p role='status'>{t('El ingreso debe estar dentro de un periodo del año.', 'Entry must fall within a school period.')}</p>}
      {incoming && subject && <fieldset className='mt-3'><legend className='fs-6'>{certificate ? t('Periodos que requieren valoración', 'Terms requiring assessment') : t('Periodos que cubre el certificado', 'Terms covered by the certificate')}</legend>
        {!periods.length && <p>{t('No hay periodos anteriores disponibles para esta materia.', 'There are no available earlier terms for this subject.')}</p>}
        <div className='d-flex gap-3 flex-wrap'>{periods.map(p => <label className='form-check' key={p.token}><input className='form-check-input'
          type='checkbox' name='periodos' value={p.token} checked={selected.includes(p.token)}
          onChange={e => setSelected(e.target.checked ? [...selected,p.token] : selected.filter(token => token !== p.token))}/>{p.nombre}</label>)}</div>
      </fieldset>}
      {save.error && <p className='text-danger mt-3' role='alert'>{save.error.message}</p>}
      <div className='d-flex justify-content-end gap-2 mt-3'><button type='button' className='btn btn-sm btn-light' onClick={cancel}>{t('Cancelar', 'Cancel')}</button>
        <button type='submit' className='btn btn-sm btn-primary' disabled={!selected.length}>{certificate ? t('Registrar sin equivalencia', 'Record missing equivalence') : t('Guardar seguimiento', 'Save follow-up')}</button></div>
    </fieldset></form>
}

function CertificateForm({data, path, t, saved, cancel}: {data: Details; path: string; t: T; saved: () => void; cancel: () => void}) {
  const [rows, setRows] = useState([0])
  const next = useRef(1)
  const [arrival, setArrival] = useState(data.fecha_ingreso ?? data.certificados[0]?.fecha_ingreso ?? '')
  const incoming = data.periodos.find(p => p.desde <= arrival && arrival <= p.hasta)
  const submit = useMutation({mutationFn: (fields: FormData) => api.post(path, fields), onSuccess: saved})
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (incoming && !submit.isPending) submit.mutate(new FormData(event.currentTarget))
  }
  return <form onSubmit={send} className='mt-4 border rounded p-4'>
    <fieldset disabled={submit.isPending}>
      <legend className='fs-5'>{t('Registrar certificado', 'Register certificate')}</legend>
      <div className='row g-3'>
        <Field label={t('Colegio de procedencia', 'Previous school')}><input className='form-control' name='colegio_origen' required maxLength={255}/></Field>
        <Field label={t('Grado de procedencia', 'Previous grade')}><input className='form-control' name='grado_origen' required maxLength={150}/></Field>
        <Field label={t('Escala del certificado', 'Certified grading scale')}><input className='form-control' name='escala_origen' required maxLength={255} placeholder={t('Ej. 0 a 100', 'e.g. 0 to 100')}/></Field>
        <Field label={t('Fecha de ingreso al colegio', 'School entry date')}><input className='form-control' type='date' name='fecha_ingreso' max={data.hoy}
          value={arrival} readOnly={!!data.fecha_ingreso || data.certificados.length > 0} onChange={e => setArrival(e.target.value)} required/></Field>
        <Field label={t('Certificado (PDF, JPG o PNG)', 'Certificate (PDF, JPG or PNG)')}><input className='form-control' type='file' name='certificado' accept='.pdf,.jpg,.jpeg,.png' required
          onChange={e => {const file = e.target.files?.[0]; e.target.setCustomValidity(file && file.size > data.max_bytes ? t('El archivo supera el tamaño permitido.', 'File exceeds the upload limit.') : '')}}/></Field>
      </div>
      {arrival && <p role='status' className='mt-3'>{incoming ? t('Periodo de ingreso', 'Entry period') + ' · ' + incoming.nombre : t('Selecciona una fecha dentro de un periodo del año.', 'Choose a date within a school period.')}</p>}
      {rows.map((id, index) => {
        const name = (key: string) => 'resultados[' + index + '][' + key + ']'
        return <fieldset key={id} className='border-top mt-5 pt-3'>
          <legend className='fs-6'>{t('Resultado certificado', 'Certified result') + ' ' + (index + 1)}</legend>
          <div className='row g-3'>
            {data.pendientes.some(p => !p.resultado_token && !p.certificado_revisado) && <Field label={t('Vincular con un periodo en trámite', 'Link to a pending term')}>
              <select className='form-select' name={name('pendiente_token')} defaultValue=''><option value=''>{t('Resultado independiente', 'Independent result')}</option>
                {data.pendientes.filter(p => !p.resultado_token && !p.certificado_revisado).map(p => <option key={p.token} value={p.token}>{p.materia} · {p.periodo}</option>)}</select></Field>}
            <Field label={t('Materia o área de origen', 'Original subject or area')}><input className='form-control' name={name('materia_origen')} required maxLength={150}/></Field>
            <Field label={t('Periodo de origen', 'Original period')}><input className='form-control' name={name('periodo_origen')} required maxLength={150}/></Field>
            <Field label={t('Definitiva original', 'Original final grade')}><input className='form-control' name={name('valor_original')} required maxLength={120}/></Field>
            <Field label={t('Desde', 'From')}><input className='form-control' type='date' name={name('desde')} required max={arrival || undefined}/></Field>
            <Field label={t('Hasta', 'Through')}><input className='form-control' type='date' name={name('hasta')} required max={arrival || undefined}/></Field>
          </div>
          {rows.length > 1 && <button className='btn btn-sm btn-light-danger mt-2' type='button' onClick={() => setRows(rows.filter(value => value !== id))}>{t('Quitar resultado', 'Remove result')}</button>}
        </fieldset>
      })}
      <button type='button' className='btn btn-sm btn-light-primary mt-3' disabled={rows.length >= 100} onClick={() => setRows([...rows, next.current++])}>{t('Añadir otro resultado', 'Add another result')}</button>
      {submit.error && <p className='text-danger mt-3' role='alert'>{submit.error.message}</p>}
      <div className='d-flex gap-2 justify-content-end flex-wrap mt-4'><button type='button' className='btn btn-light btn-sm' onClick={cancel}>{t('Cancelar', 'Cancel')}</button>
        <button type='submit' className='btn btn-primary btn-sm' disabled={!incoming || submit.isPending}>{t('Guardar certificado', 'Save certificate')}</button></div>
    </fieldset>
  </form>
}

function Approval({result, certificate, data, path, t, refresh}: {result: Result; certificate: Certificate; data: Details; path: string; t: T; refresh: () => Promise<unknown>}) {
  const [editing, setEditing] = useState(false)
  const toast = useToast()
  const scale = data.escala
  const pending = data.pendientes.find(p => p.resultado_token === result.token)
  const subjects = pending ? data.materias.filter(m => m.token === pending.materia_token) : data.materias
  const periods = data.periodos.filter(p => p.hasta < certificate.fecha_ingreso && (!pending || p.token === pending.periodo_token))
  const save = useMutation({mutationFn: (fields: Record<string, FormDataEntryValue>) => api.post(path + '/' + result.token + '/aprobar', {...fields, version_escala: scale?.version}),
    onSuccess: async () => {
      setEditing(false)
      toast.success(t('Equivalencia aprobada.', 'Equivalence approved.'), 'updated')
      await refresh()
    },
    onError: error => {if (error instanceof ApiError && error.status === 409) void refresh()},
  })
  if (result.decision) {
    const decision = result.decision
    return <div className='border-start border-success border-3 ps-3 mt-2'>
      <strong>{t('Equivalencia aprobada', 'Approved equivalence')} · {decision.materia} · {decision.periodo} · {decision.categoria ?? decision.valor}</strong>
      <div>{decision.siee.nombre} ({decision.siee.minimo}–{decision.siee.maximo}){decision.categoria && ' · ' + decision.valor}</div>
      <div>{decision.criterio}</div><small>{decision.responsable} · {result.aprobado_en?.slice(0, 10)}</small>
      {result.eleccion && <GradeSourceChoice key={result.eleccion.huella + result.eleccion.version} comparison={result.eleccion} allowed={data.puede_elegir} path={path + '/' + result.token + '/eleccion'} refresh={refresh} t={t}/>}
      <GradeRectification label={t('Rectificar definitiva', 'Correct final grade')} result={result} path={path} allowed={data.puede_rectificar} maxBytes={data.max_bytes} refresh={refresh} t={t}/></div>
  }
  if (!editing || !scale) return <div className='d-flex gap-3 align-items-center flex-wrap mt-2'><span>{t('Pendiente de equivalencia', 'Pending equivalence')}</span>
    {data.puede_aprobar && scale && <button type='button' className='btn btn-sm btn-light-primary' onClick={() => setEditing(true)}>{t('Revisar equivalencia', 'Review equivalence')}</button>}</div>
  return <form className='mt-3' onSubmit={e => {e.preventDefault(); if (!save.isPending) save.mutate(Object.fromEntries(new FormData(e.currentTarget)))}}>
    <fieldset disabled={save.isPending}><div className='row g-3'>
      <Field label={t('Materia del colegio', 'Local subject')}><select name='materia_token' className='form-select' required defaultValue={pending?.materia_token ?? ''}><option value=''>{t('Selecciona', 'Select')}</option>
        {subjects.map(m => <option key={m.token} value={m.token}>{m.nombre}</option>)}</select></Field>
      <Field label={t('Periodo reconocido', 'Recognized period')}><select name='periodo_token' className='form-select' required defaultValue={pending?.periodo_token ?? ''}><option value=''>{t('Selecciona', 'Select')}</option>
        {periods.map(p => <option key={p.token} value={p.token}>{p.nombre}</option>)}</select></Field>
      <Field label={t('Definitiva reconocida', 'Recognized grade') + ' · ' + scale.nombre}>{scale.opciones.length ?
        <select name='opcion_token' className='form-select' required defaultValue=''><option value=''>{t('Selecciona', 'Select')}</option>{scale.opciones.map(o => <option key={o.token} value={o.token}>{o.nombre}</option>)}</select>
        : <input name='valor' className='form-control' type='number' step={10 ** -scale.decimales} min={scale.minimo} max={scale.maximo} placeholder={scale.minimo + ' – ' + scale.maximo} required/>}</Field>
      </div>
      <label className='form-label d-block mt-3'>{t('Criterio de equivalencia', 'Basis for equivalence')}<textarea className='form-control' name='criterio' required maxLength={1500}/></label>
      <p className='form-text'>{t('Si el colegio ya tiene una definitiva para este periodo, deberá elegir cuál cuenta. Ambas quedarán en el historial.', 'If the school already has a final grade for this term, it must choose which one counts. Both will remain in the history.')}</p>
      {!data.materias.length && <p role='status'>{t('Configura las materias del currículo de este grado para aprobar.', 'Configure the curriculum for this grade to approve.')}</p>}
      {!periods.length && <p role='status'>{t('No hay periodos locales anteriores al ingreso.', 'There are no local periods before entry.')}</p>}
      {save.error && <p className='text-danger' role='alert'>{save.error.message}</p>}
      <div className='d-flex gap-2 flex-wrap'><button type='button' className='btn btn-sm btn-light' onClick={() => setEditing(false)}>{t('Cancelar', 'Cancel')}</button>
        <button className='btn btn-sm btn-primary' type='submit' disabled={save.isPending || !periods.length || !data.materias.length}>{t('Aprobar equivalencia', 'Approve equivalence')}</button></div>
    </fieldset>
  </form>
}

export function ExternalGrades({token}: {token: string}) {
  const en = useIntl().locale.startsWith('en')
  const t: T = (es, english) => en ? english : es
  const scope = useEnrollmentScope()
  const cache = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<string | null>(null)
  const path = '/matriculas/' + encodeURIComponent(token) + '/definitivas-externas'
  const query = useQuery({queryKey: ['matriculas', scope, 'definitivas-externas', token], enabled: open, queryFn: () => api.get<Details>(path)})
  const data = query.data
  const tracking = data?.pendientes.filter(p => !p.certificado_revisado) ?? []
  const refresh = () => Promise.all([query.refetch(), ...['evaluacion','boletines','anos-lectivos'].map(k => cache.invalidateQueries({queryKey: [k]})), cache.invalidateQueries({queryKey: ['matriculas', scope, 'valoraciones-ingreso', token]})])
  return <section className='border-top mt-5 pt-4'><button type='button' className='btn btn-light-primary' aria-expanded={open} onClick={() => setOpen(!open)}>{t('Definitivas de otro colegio', 'Prior school grades')}</button>
    {open && <div className='mt-3'>
      {query.isPending && <p role='status'>{t('Cargando resultados…', 'Loading results…')}</p>}
      {query.error && <p role='alert'>{query.error.message}</p>}
      {data && <>{data.certificados.length === 0 && <p>{t('Sin certificados registrados.', 'No certificates registered.')}</p>}
        {tracking.length > 0 && <ul className='list-unstyled mt-3'>{tracking.map(p => <li className='border rounded p-3 mb-2' key={p.token}>
          <strong>{p.materia} · {p.periodo} · {p.aprobado_en ? t('Equivalencia aprobada', 'Equivalence approved')
            : p.resultado_token ? t('Certificado recibido, pendiente de aprobación', 'Certificate received, awaiting approval') : t('Certificado en trámite', 'Awaiting certificate')}</strong>
          <small className='d-block'>{t('Seguimiento', 'Follow-up')} · {p.responsable} · {p.fecha_seguimiento}</small>
          {p.aprobado_en && <small>{t('Aprobación', 'Approval')} · {p.aprobado_por} · {p.aprobado_en.slice(0,10)}</small>}</li>)}</ul>}
        {data.puede_registrar && !form && <div className='d-flex flex-wrap gap-2'>
          <button className='btn btn-primary btn-sm' onClick={() => setForm('certificate')}>{t('Registrar certificado', 'Register certificate')}</button>
          <button className='btn btn-light-primary btn-sm' onClick={() => setForm('pending')}>{t('Registrar certificado en trámite', 'Track pending certificate')}</button></div>}
        {form === 'pending' && data.puede_registrar && <PendingForm data={data} path={path} t={t} cancel={() => setForm(null)} saved={() => {
          setForm(null); toast.success(t('Seguimiento registrado.', 'Follow-up registered.')); void refresh()
        }}/>}
        {form === 'certificate' && data.puede_registrar && <CertificateForm data={data} path={path} t={t} cancel={() => setForm(null)} saved={() => {
          setForm(null); toast.success(t('Certificado registrado.', 'Certificate registered.')); void refresh()
        }}/>}
        {data.error_escala && data.puede_aprobar && <p className='alert alert-warning mt-3'>{data.error_escala}</p>}
        {data.certificados.map(c => <article key={c.archivo_token} className='border rounded p-4 mt-4 text-break'>
          <div className='d-flex flex-wrap align-items-center justify-content-between gap-2'><h4>{c.colegio_origen} · {c.grado_origen}</h4>
            <a href={'/api' + path + '/certificados/' + c.archivo_token} download className='btn btn-light btn-sm'>{c.archivo_nombre}</a></div>
          <p>{t('Ingreso', 'Entry')} · {c.periodo_ingreso} · {c.fecha_ingreso}<br/>{t('Escala de origen', 'Original scale')} · {c.escala_origen}<br/>
            {t('Registrado por', 'Recorded by')} {c.registrado_por} · {c.registrado_en.slice(0,10)}</p>
          {c.resultados.map(r => <div className='border-top py-3' key={r.token}>
            <b>{r.materia_origen} · {r.periodo_origen} · {r.valor_original}</b><div>{r.desde} – {r.hasta}</div>
            <Approval result={r} certificate={c} path={path} data={data} refresh={refresh} t={t}/>
          </div>)}
          {data.pendientes.filter(p => p.certificado_revisado === c.archivo_token).map(p => <div className='border-top py-3' key={p.token}>
            <strong>{p.materia} · {p.periodo} · {p.aprobado_en ? t('Valoración aprobada', 'Assessment approved')
              : p.valoracion_token ? t('Pendiente de aprobación', 'Awaiting approval') : t('Pendiente de valoración', 'Pending assessment')}</strong>
            <div>{t('Sin equivalencia', 'No equivalence')} · {p.motivo_sin_equivalencia}</div>
            <small>{t('Seguimiento', 'Follow-up')} · {p.responsable} · {p.fecha_seguimiento}</small>
            {p.aprobado_en && <small className='d-block'>{t('Aprobación', 'Approval')} · {p.aprobado_por} · {p.aprobado_en.slice(0,10)}</small>}
          </div>)}
          {data.puede_aprobar && !form && <button type='button' className='btn btn-sm btn-light-primary' onClick={() => setForm(c.archivo_token)}>
            {t('Marcar materia sin equivalencia', 'Mark subject without equivalence')}</button>}
          {data.puede_aprobar && form === c.archivo_token && <PendingForm certificate={c} data={data} path={path} t={t} cancel={() => setForm(null)} saved={() => {
            setForm(null); toast.success(t('Periodos registrados para valoración.', 'Terms recorded for assessment.')); void refresh()
          }}/>}
        </article>)}
      </>}
    </div>}
  </section>
}
