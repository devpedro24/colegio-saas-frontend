import {useState, type FormEvent} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import {AcademicPageHeader} from '@/app/shared/components/AcademicPageHeader'
import {EnrollmentAddress, type Department} from './EnrollmentAddress'
import type {Campaign, StudentData, DocumentVersion} from './ingreso.types'
import {useEnrollmentScope} from './enrollmentSettings.api'
import {IntakeIcon} from './IntakeUI'

type Row = {token: string; nombre: string; email: string; estado: string; grupo: string; sede: string; convocatoria: string | null; origen: string}
type Catalog = {data: Row[]; page: number; last_page: number; total: number; ano_token: string | null;
  anos: {token: string; nombre: string; estado: string}[]; grupos: {token: string; grado_token: string; nombre: string; sede: string; estado: string}[];
  campanas: Campaign[]; correo_operativo: boolean}

function ManualEnrollment({catalog, onClose, onSaved}: {catalog: Catalog; onClose: () => void; onSaved: (mail: boolean) => void}) {
  const intl = useIntl()
  const en = intl.locale.startsWith('en')
  const text = (es: string, english: string) => en ? english : es
  const [campaignToken, setCampaign] = useState('')
  const campaign = catalog.campanas.find(item => item.url_token === campaignToken)
  const [campus, setCampus] = useState('')
  const [groupToken, setGroup] = useState('')
  const [email, setEmail] = useState('')
  const [data, setData] = useState<StudentData>({pais: 'CO', adicionales: {}})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [submissionKey] = useState(() => crypto.randomUUID())
  const geography = useQuery({queryKey: ['matriculas', 'geografia'], queryFn: () => api.get<{departamentos: Department[]}>('/matriculas/geografia')})
  const groups = catalog.grupos.filter(item => item.estado === 'activo' && campaign?.configuracion.grados.some(grade => grade.token === item.grado_token))
  const campuses = [...new Set(groups.map(item => item.sede))]
  const selectedCampus = campus || (campuses.length === 1 ? campuses[0] : '')
  const group = groups.find(item => item.token === groupToken)
  const requirements = campaign?.configuracion.documentos.filter(item => !item.grados.length || item.grados.includes(group?.grado_token ?? '')) ?? []
  const save = useMutation({mutationFn: async () => {
    const form = new FormData()
    form.set('campana_token', campaignToken); form.set('grupo_token', groupToken); form.set('email', email)
    form.set('datos', JSON.stringify(data)); form.set('envio_token', submissionKey)
    form.set('enviar', '1'); form.set('consentimiento', '1')
    form.set('privacidad_version', campaign!.privacidad_version ?? '')
    for (const requirement of requirements) if (files[requirement.key]) form.set(`documentos[${requirement.key}]`, files[requirement.key])
    return api.post<{data: Row; correo_operativo: boolean}>('/matriculas', form)
  }, onSuccess: response => onSaved(response.correo_operativo)})
  const fields: Array<[keyof Omit<StudentData, 'adicionales'>, string, string, boolean, string]> = [
    ['primer_nombre', 'Primer nombre', 'First name', true, 'text'], ['segundo_nombre', 'Segundo nombre', 'Middle name', false, 'text'],
    ['primer_apellido', 'Primer apellido', 'First surname', true, 'text'], ['segundo_apellido', 'Segundo apellido', 'Second surname', false, 'text'],
    ['nacimiento', 'Fecha de nacimiento', 'Birth date', true, 'date'], ['numero_documento', 'Número de documento', 'Identity number', true, 'text'],
    ['telefono', 'Teléfono (ej. +573001234567)', 'Phone (e.g. +573001234567)', true, 'tel'],
  ]
  const submit = (event: FormEvent) => {event.preventDefault(); if (!save.isPending) save.mutate()}
  return <section className='card'><div className='card-header'><h3 className='card-title'>{text('Matrícula manual', 'Manual enrollment')}</h3></div>
    <form className='card-body' onSubmit={submit}><fieldset disabled={save.isPending}>
      <p className='text-muted'>{text('Completa la ficha y los documentos de la convocatoria. Al confirmar se crea la matrícula y se envía el acceso por correo; las renovaciones conservan su cuenta.',
        'Complete the campaign information and documents. Confirmation creates enrollment and emails access credentials; renewals keep their account.')}</p>
      {!catalog.correo_operativo && <div className='alert alert-warning'>{text('El correo institucional no está operativo. No se puede garantizar la entrega del acceso.', 'School mail is not operational. Access delivery cannot be guaranteed.')}</div>}
      <div className='row g-5 mb-5'>
        <div className='col-md-4'><label className='form-label' htmlFor='manual-campaign'>{text('Convocatoria', 'Campaign')}</label><select id='manual-campaign' className='form-select' required value={campaignToken}
          onChange={e => {setCampaign(e.target.value); setGroup(''); setCampus(''); setFiles({}); setData(current => ({...current, adicionales: {}}))}}>
          <option value=''>{text('Selecciona', 'Select')}</option>{catalog.campanas.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}</select></div>
        <div className='col-md-4'><label className='form-label' htmlFor='manual-campus'>{text('Sede', 'Campus')}</label><select id='manual-campus' className='form-select' value={selectedCampus} required disabled={campuses.length === 1}
          onChange={e => {setCampus(e.target.value); setGroup('')}}><option value=''>{text('Selecciona', 'Select')}</option>{campuses.map(item => <option key={item}>{item}</option>)}</select></div>
        <div className='col-md-4'><label className='form-label' htmlFor='manual-group'>{text('Grupo', 'Group')}</label><select id='manual-group' required className='form-select' value={groupToken} onChange={e => setGroup(e.target.value)}>
          <option value=''>{text('Selecciona', 'Select')}</option>{groups.filter(item => item.sede === selectedCampus).map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}</select></div>
      </div>
      <div className='row g-5'>{fields.map(([key, es, english, required, type]) => <div className='col-md-6' key={key}>
        <label className={`form-label ${required ? 'required' : ''}`} htmlFor={`manual-${key}`}>{text(es, english)}</label>
        <input id={`manual-${key}`} type={type} required={required} maxLength={key === 'telefono' ? 16 : 80} className='form-control' value={data[key] ?? ''}
          pattern={key === 'telefono' ? '\\+[0-9]{7,15}' : undefined} onChange={e => setData({...data, [key]: key === 'telefono' ? e.target.value.replace(/[^+0-9]/g, '') : e.target.value})} /></div>)}
        <div className='col-md-6'><label className='form-label required' htmlFor='manual-document-type'>{text('Tipo de documento', 'Document type')}</label>
          <select id='manual-document-type' required className='form-select' value={data.tipo_documento ?? ''} onChange={e => setData({...data, tipo_documento: e.target.value})}><option value=''>{text('Selecciona', 'Select')}</option>
            {['RC', 'TI', 'CC', 'CE', 'PASAPORTE', 'OTRO'].map(type => <option key={type}>{type}</option>)}</select></div>
        <div className='col-md-6'><label className='form-label required' htmlFor='manual-email'>{text('Correo del estudiante', 'Student email')}</label><input id='manual-email' type='email' required className='form-control' value={email} onChange={e => setEmail(e.target.value)} /></div>
      </div>
      <div className='d-grid gap-4 my-5' style={{gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'}}>
        <EnrollmentAddress data={data} departments={geography.data?.departamentos ?? []} disabled={save.isPending} onChange={setData} />
      </div>
      {geography.error && <div role='alert' className='alert alert-danger'>{geography.error.message}</div>}
      {campaign?.configuracion.campos.map(field => <div className='mb-4' key={field.key}><label className='form-label' htmlFor={`manual-extra-${field.key}`}>{field.nombre}</label>
        {field.tipo === 'seleccion' ? <select id={`manual-extra-${field.key}`} className='form-select' required={field.obligatorio} value={data.adicionales[field.key] ?? ''} onChange={e => setData({...data, adicionales: {...data.adicionales, [field.key]: e.target.value}})}><option value=''>{text('Selecciona', 'Select')}</option>{field.opciones?.map(option => <option key={option}>{option}</option>)}</select> : <input id={`manual-extra-${field.key}`} className='form-control' required={field.obligatorio} type={field.tipo === 'fecha' ? 'date' : field.tipo === 'email' ? 'email' : field.tipo === 'telefono' ? 'tel' : 'text'}
          inputMode={['numero', 'telefono'].includes(field.tipo) ? 'numeric' : undefined} pattern={['numero', 'telefono'].includes(field.tipo) ? '[0-9]+' : undefined}
          value={data.adicionales[field.key] ?? ''} onChange={e => setData({...data, adicionales: {...data.adicionales, [field.key]: ['numero', 'telefono'].includes(field.tipo) ? e.target.value.replace(/\D/g, '') : e.target.value}})} />}</div>)}
      {requirements.map(requirement => <div className='mb-4' key={`${campaignToken}-${requirement.key}`}><label className='form-label' htmlFor={`manual-file-${requirement.key}`}>{requirement.nombre}</label>
        <input id={`manual-file-${requirement.key}`} className='form-control' type='file' required={requirement.obligatorio} accept={requirement.formatos.map(format => `.${format}`).join(',')}
          onChange={e => setFiles(current => {const next = {...current}; if (e.target.files?.[0]) next[requirement.key] = e.target.files[0]; else delete next[requirement.key]; return next})} />
        <p className='text-muted mt-2'>{requirement.instrucciones}</p>{requirement.vigencia && <p className='text-muted'>{requirement.vigencia}</p>}</div>)}
      {campaign && <><p className='text-muted' style={{whiteSpace: 'pre-wrap'}}>{campaign.configuracion.privacidad}</p>
        <label className='form-check d-flex gap-3 my-5'><input type='checkbox' required className='form-check-input' /><span>{text('Confirmo que recibí y revisé los documentos y la autorización del representante legal.', 'I confirm receipt and review of the documents and legal representative authorization.')}</span></label></>}
      {save.error && <div className='alert alert-danger' role='alert'>{save.error.message}</div>}
      <div className='d-flex justify-content-end gap-3'><button type='button' className='btn btn-light' onClick={onClose}>{text('Cancelar', 'Cancel')}</button>
        <button type='submit' className='btn btn-primary' disabled={!group || !campaign || save.isPending}>{text('Confirmar matrícula', 'Confirm enrollment')}</button></div>
    </fieldset></form></section>
}

function StudentFile({token, onClose}: {token: string; onClose: () => void}) {
  const intl = useIntl()
  const en = intl.locale.startsWith('en')
  const scope = useEnrollmentScope()
  const query = useQuery({queryKey: ['matriculas', scope, 'ficha', token], queryFn: () => api.get<{data: Row & {datos: StudentData; documentos: DocumentVersion[]}}>(`/matriculas/${encodeURIComponent(token)}`)})
  const item = query.data?.data
  const labels: Record<string, string> = en ? {primer_nombre: 'First name', segundo_nombre: 'Middle name', primer_apellido: 'First surname', segundo_apellido: 'Second surname', nacimiento: 'Birth date', tipo_documento: 'Document type', numero_documento: 'Document number', telefono: 'Phone', direccion: 'Address', pais: 'Country', departamento: 'Department', municipio: 'Municipality'}
    : {primer_nombre: 'Primer nombre', segundo_nombre: 'Segundo nombre', primer_apellido: 'Primer apellido', segundo_apellido: 'Segundo apellido', nacimiento: 'Nacimiento', tipo_documento: 'Tipo de documento', numero_documento: 'Documento', telefono: 'Teléfono', direccion: 'Dirección', pais: 'País', departamento: 'Departamento', municipio: 'Municipio'}
  return <section className='card card-body'><div className='d-flex justify-content-between gap-3'><h3>{item?.nombre}</h3><button className='btn btn-light btn-sm' onClick={onClose}>{en ? 'Close' : 'Cerrar'}</button></div>
    {query.isLoading && <p role='status'>…</p>}{query.error && <p role='alert'>{query.error.message}</p>}
    {item && <><p>{item.email} · {item.grupo} · {item.sede}</p><dl className='row'>{Object.entries(item.datos).filter(([key, value]) => key !== 'adicionales' && value).map(([key, value]) => <div className='col-md-6 mb-4' key={key}><dt>{labels[key] ?? key}</dt><dd>{String(value)}</dd></div>)}</dl>
      {Object.entries(item.datos.adicionales ?? {}).map(([key, value]) => <p key={key}><strong>{key.replace(/_/g, ' ')}</strong>: {value}</p>)}
      <div className='d-flex flex-wrap gap-3'>{item.documentos.filter(doc => doc.estado !== 'retirado').map(doc => <a key={doc.url_token} className='btn btn-light-primary btn-sm' target='_blank' rel='noreferrer'
        href={`/api/matriculas/${encodeURIComponent(token)}/documentos/${encodeURIComponent(doc.url_token)}`}>{doc.nombre} · v{doc.version}</a>)}</div></>}
  </section>
}

export default function EnrollmentRoster({embedded = false}: {embedded?: boolean}) {
  const intl = useIntl()
  const scope = useEnrollmentScope()
  const en = intl.locale.startsWith('en')
  const text = (es: string, english: string) => en ? english : es
  const cache = useQueryClient()
  const [filters, setFilters] = useState({ano_token: '', grupo_token: '', campana_token: '', origen: '', buscar: '', page: '1'})
  const [manual, setManual] = useState(false)
  const [detail, setDetail] = useState('')
  const [notice, setNotice] = useState('')
  const query = useQuery({queryKey: ['matriculas', scope, 'listado', filters], staleTime: 30000, queryFn: () => api.get<Catalog>(`/matriculas?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value))}`)})
  const catalog = query.data
  const change = (key: keyof typeof filters, value: string) => {setFilters(current => ({...current, [key]: value, page: '1'})); setDetail(''); setManual(false)}
  const manualButton = <button className='btn btn-primary' disabled={!catalog || catalog.anos.find(year => year.token === catalog.ano_token)?.estado === 'cerrado'} onClick={() => {setManual(true); setDetail(''); setNotice('')}}><IntakeIcon name='plus-lg' />{text('Matrícula manual', 'Manual enrollment')}</button>
  return <div className={`d-flex flex-column gap-5 ${embedded ? 'intake-roster-embedded' : ''}`}>{!embedded && <AcademicPageHeader title={text('Gestión de matrículas', 'Enrollment management')}
    description={text('Estudiantes matriculados por año, convocatoria y grupo. Consulta su ficha o registra una matrícula manual.', 'Students enrolled by year, campaign and group. View their file or register a manual enrollment.')}>
    {manualButton}
  </AcademicPageHeader>}
    {notice && <div className='alert alert-info' role='status'>{notice}</div>}
    <div className={embedded ? 'intake-card' : 'card card-body'}>{embedded && <div className='intake-heading mb-5'><h2>{text('Estudiantes matriculados', 'Enrolled students')}</h2>{manualButton}</div>}<div className='row g-4'>
      <div className='col-md-3'><label className='form-label' htmlFor='roster-year'>{text('Año lectivo', 'School year')}</label><select id='roster-year' className='form-select' value={filters.ano_token || catalog?.ano_token || ''} onChange={e => {setFilters({...filters, ano_token: e.target.value, grupo_token: '', campana_token: '', page: '1'}); setManual(false); setDetail('')}}>
        {catalog?.anos.map(year => <option key={year.token} value={year.token}>{year.nombre}</option>)}</select></div>
      <div className='col-md-3'><label className='form-label' htmlFor='roster-group'>{text('Grupo', 'Group')}</label><select id='roster-group' className='form-select' value={filters.grupo_token} onChange={e => change('grupo_token', e.target.value)}><option value=''>{text('Todos', 'All')}</option>
        {catalog?.grupos.map(group => <option key={group.token} value={group.token}>{group.nombre}</option>)}</select></div>
      <div className='col-md-3'><label className='form-label' htmlFor='roster-campaign'>{text('Convocatoria', 'Campaign')}</label><select id='roster-campaign' className='form-select' value={filters.campana_token} onChange={e => change('campana_token', e.target.value)}><option value=''>{text('Todas', 'All')}</option>
        {catalog?.campanas.map(campaign => <option key={campaign.url_token} value={campaign.url_token}>{campaign.nombre}</option>)}</select></div>
      <div className='col-md-3'><label className='form-label' htmlFor='roster-source'>{text('Origen', 'Source')}</label><select id='roster-source' className='form-select' value={filters.origen} onChange={e => change('origen', e.target.value)}><option value=''>{text('Todos', 'All')}</option><option value='manual'>Manual</option><option value='enlace'>{text('Por enlace', 'Public link')}</option></select></div>
      <div className='col-md-6'><label className='form-label' htmlFor='roster-search'>{text('Buscar estudiante', 'Find student')}</label><input id='roster-search' className='form-control' value={filters.buscar} onChange={e => change('buscar', e.target.value)} /></div>
    </div></div>
    {query.error && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
    {manual && catalog && <ManualEnrollment catalog={catalog} onClose={() => setManual(false)} onSaved={mail => {setManual(false); void cache.invalidateQueries({queryKey: ['matriculas']});
      setNotice(mail ? text('Matrícula registrada. El envío del acceso quedó en la cola de correo.', 'Enrollment registered. Access delivery was queued.') : text('Matrícula registrada. Configura el correo institucional para entregar el acceso.', 'Enrollment registered. Configure school mail to deliver access.'))}} />}
    {detail && <StudentFile token={detail} onClose={() => setDetail('')} />}
    <div className={embedded ? 'intake-card' : 'card card-body'}><div className='table-responsive'><table className={embedded ? 'intake-table' : 'table align-middle table-row-dashed'}><thead><tr>{[text('Estudiante', 'Student'), text('Grupo / sede', 'Group / campus'), text('Convocatoria / origen', 'Campaign / source'), text('Estado', 'Status'), ''].map((label, index) => <th key={index}>{label}</th>)}</tr></thead>
      <tbody>{catalog?.data.map(row => <tr key={row.token}><td className='intake-student-cell'><strong>{row.nombre}</strong><div className='text-muted'>{row.email}</div></td><td>{row.grupo}<div className='text-muted'>{row.sede}</div></td><td>{row.convocatoria ?? '—'}<div className='text-muted'>{row.origen === 'manual' ? 'Manual' : text('Por enlace', 'Public link')}</div></td><td className='intake-status-cell'><span className='intake-badge'>{row.estado}</span></td><td className='intake-action-cell'><button className='btn btn-light-primary btn-sm' onClick={() => {setDetail(row.token); setManual(false)}}>{text('Ver ficha', 'View file')}</button></td></tr>)}</tbody></table></div>
      {query.isFetching && <p role='status'>…</p>}
      {catalog && <div className='d-flex gap-4 align-items-center'><button className='btn btn-light btn-sm' disabled={catalog.page <= 1 || query.isFetching} onClick={() => setFilters({...filters, page: String(catalog.page - 1)})}>{text('Anterior', 'Previous')}</button>
        <span>{catalog.page} / {catalog.last_page} · {catalog.total}</span><button className='btn btn-light btn-sm' disabled={catalog.page >= catalog.last_page || query.isFetching} onClick={() => setFilters({...filters, page: String(catalog.page + 1)})}>{text('Siguiente', 'Next')}</button></div>}
    </div>
  </div>
}
