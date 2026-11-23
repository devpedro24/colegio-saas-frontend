import {useState, type FormEvent} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {Field, type GradeContext} from './ExternalGrades'
import {useEnrollmentScope} from './enrollmentSettings.api'

type Option = {token: string; nombre: string}
type Grant = {token: string; materia: string; periodo: string; responsable: string; autorizado_por: string; autorizado_en: string;
  materia_token: string; periodo_token: string; vigente: string | null; version: number | null;
  es_rectificacion: boolean; puede_autorizar_rectificacion: boolean; escala_rectificacion: Omit<NonNullable<GradeContext['escala']>, 'version'> | null;
  motivo: string; anterior: string | null; registrada: string | null; aprobado_en: string | null; revocado_en: string | null;
  archivo_token: string; archivo_nombre: string; puede_revocar: boolean; puede_registrar: boolean}
type Details = Pick<GradeContext, 'escala' | 'error_escala' | 'materias' | 'max_bytes'> & {
  puede_autorizar: boolean; periodos: Option[]; responsables: Option[]; responsables_rectificacion: Option[]; autorizaciones: Grant[]}
type Action = {kind: 'grant'; request: string; target?: Grant; grant?: never} | {kind: 'register' | 'revoke'; grant: Grant}
const options = (items: Option[], placeholder: string) => <><option value=''>{placeholder}</option>
  {items.map(item => <option value={item.token} key={item.token}>{item.nombre}</option>)}</>

export function ClosedGradeAuthorizations({token}: {token: string}) {
  const intl = useIntl(), en = intl.locale.startsWith('en')
  const t = (es: string, english: string) => en ? english : es
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<Action | null>(null)
  const scope = useEnrollmentScope(), cache = useQueryClient(), toast = useToast()
  const path = '/matriculas/' + encodeURIComponent(token) + '/autorizaciones-cierre'
  const query = useQuery({queryKey: ['matriculas', scope, 'autorizaciones-cierre', token], enabled: open, queryFn: () => api.get<Details>(path)})
  const data = query.data, scale = data?.escala
  const entryScale = action?.grant?.escala_rectificacion ?? scale
  const mutation = useMutation({mutationFn: ({op, fields}: {op: Action; fields: FormData}) => {
    if (op.kind === 'grant') {
      fields.set('solicitud_token', op.request)
      if (op.target) {
        fields.set('rectifica_token', op.target.token)
        fields.set('version', String(op.target.version))
        fields.set('materia_token', op.target.materia_token)
        fields.set('periodo_token', op.target.periodo_token)
      }
      return api.post(path, fields)
    }
    const url = path + '/' + encodeURIComponent(op.grant.token)
    return op.kind === 'register' ? api.post(url + '/registrar', {...Object.fromEntries(fields), version_escala: scale?.version})
      : api.post(url + '/revocar', Object.fromEntries(fields))
  }, onSuccess: async (_, {op}) => {
    setAction(null)
    toast.success(op.kind === 'grant' ? t('Autorización guardada.', 'Authorization saved.') : op.kind === 'register'
      ? t('Definitiva registrada.', 'Final grade recorded.') : t('Autorización revocada.', 'Authorization revoked.'), 'updated')
    await Promise.all([cache.invalidateQueries({queryKey: ['matriculas', scope]}),
      ...(op.kind === 'register' ? ['evaluacion','boletines','anos-lectivos'].map(key => cache.invalidateQueries({queryKey: [key]})) : [])])
  }})
  const edit = (op: Action | null) => {mutation.reset(); setAction(op)}
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (action && !mutation.isPending) mutation.mutate({op: action, fields: new FormData(event.currentTarget)})
  }
  const choose = t('Selecciona', 'Select')
  const controls = (label: string) => <div className='mt-3'>
    {mutation.error && <p role='alert' className='text-danger'>{mutation.error.message}</p>}
    <button type='submit' disabled={mutation.isPending} className='btn btn-primary btn-sm me-2'>{label}</button>
    <button type='button' disabled={mutation.isPending} className='btn btn-light btn-sm' onClick={() => edit(null)}>{t('Cancelar', 'Cancel')}</button>
  </div>
  return <section className='border-top mt-5 pt-4'>
    <button type='button' className='btn btn-light-primary' aria-expanded={open} onClick={() => setOpen(!open)}>
      {t('Definitivas en periodos cerrados', 'Final grades in closed periods')}</button>
    {open && <div className='mt-3'>
      {query.isPending && <p role='status'>{t('Cargando…', 'Loading…')}</p>}{query.error && <p role='alert'>{query.error.message}</p>}
      {data && <>
        {data.error_escala && <p role='alert'>{data.error_escala}</p>}
        {!!data.puede_autorizar && !data.periodos.length && <p>{t('Todavía no hay periodos cerrados.', 'There are no closed periods yet.')}</p>}
        {data.puede_autorizar && !!data.periodos.length && scale && !action && <button type='button' className='btn btn-sm btn-primary'
          onClick={() => edit({kind: 'grant', request: crypto.randomUUID()})}>{t('Nueva autorización individual', 'New individual authorization')}</button>}
        {action?.kind === 'grant' && <form onSubmit={submit} className='border rounded p-3'>
          {action.target && <p><strong>{t('Autorizar rectificación', 'Authorize correction')}</strong> · {action.target.materia} · {action.target.periodo}
            <br/>{t('Definitiva vigente', 'Current final grade')} · {action.target.vigente}</p>}
          <div className='row g-3'>
            {!action.target && <>
            <Field label={t('Materia', 'Subject')}><select className='form-select' name='materia_token' required defaultValue=''>{options(data.materias, choose)}</select></Field>
            <Field label={t('Periodo cerrado', 'Closed period')}><select className='form-select' name='periodo_token' required defaultValue=''>{options(data.periodos, choose)}</select></Field>
            </>}
            <Field label={t('Quién registrará la definitiva', 'Who will enter the grade')}><select className='form-select' name='responsable_token' required defaultValue=''>{options(action.target ? data.responsables_rectificacion : data.responsables, choose)}</select></Field>
          </div>
          <label className='form-label d-block mt-3'>{t('Motivo de la autorización', 'Reason for authorization')}
            <textarea className='form-control' name='motivo' required maxLength={1500}/></label>
          <label className='form-label d-block'>{t('Soporte', 'Supporting document')}
            <input className='form-control' type='file' name='soporte' accept='.pdf,.jpg,.jpeg,.png' required onChange={e => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.setCustomValidity(file && file.size > data.max_bytes ? t('El archivo supera el tamaño permitido.', 'The file exceeds the upload limit.') : '')
            }}/></label>
          {controls(action.target ? t('Crear autorización de rectificación', 'Create correction authorization') : t('Autorizar registro', 'Authorize entry'))}
        </form>}
        {data.autorizaciones.map(row => <article key={row.token} className='border rounded p-3 mt-3 text-break'>
          <strong>{row.materia} · {row.periodo}</strong>
          <p className='mb-1'>{row.revocado_en ? t('Revocada', 'Revoked') : row.aprobado_en
            ? (row.es_rectificacion ? t('Definitiva rectificada', 'Corrected final grade') : t('Definitiva registrada', 'Final grade recorded')) + ' · ' + row.registrada
            : row.es_rectificacion ? t('Rectificación autorizada · pendiente de registro', 'Correction authorized · awaiting entry') : t('Autorizada · pendiente de registro', 'Authorized · awaiting entry')}</p>
          {!row.es_rectificacion && row.version != null && row.version > 0 && <p className='mb-1'>{t('Definitiva vigente', 'Current final grade')} · {row.vigente}</p>}
          <small className='d-block'>{t('Autorizó', 'Authorized by')} · {row.autorizado_por} · {row.autorizado_en.slice(0,10)}</small>
          <small className='d-block'>{t('Responsable del registro', 'Grade entry by')} · {row.responsable}{row.aprobado_en && ' · ' + row.aprobado_en.slice(0,10)}</small>
          {row.anterior != null && <small>{t('Definitiva anterior', 'Previous final grade')} · {row.anterior}</small>}
          <p className='my-2'>{row.motivo}</p><a href={'/api' + path + '/soportes/' + row.archivo_token} download>{row.archivo_nombre}</a>
          {!action && <div className='d-flex gap-2 mt-2'>
            {row.puede_autorizar_rectificacion && <button className='btn btn-sm btn-light-primary' onClick={() => edit({kind: 'grant', request: crypto.randomUUID(), target: row})}>{t('Autorizar rectificación', 'Authorize correction')}</button>}
            {row.puede_registrar && <button className='btn btn-sm btn-primary' onClick={() => edit({kind: 'register', grant: row})}>{row.es_rectificacion ? t('Registrar rectificación', 'Record correction') : t('Registrar definitiva', 'Record final grade')}</button>}
            {row.puede_revocar && <button className='btn btn-sm btn-light-danger' onClick={() => edit({kind: 'revoke', grant: row})}>{t('Revocar', 'Revoke')}</button>}
          </div>}
          {action?.grant?.token === row.token && <form className='mt-3' onSubmit={submit}>
            {action.kind === 'register' && entryScale && <label className='form-label'>{t('Definitiva', 'Final grade')} · {entryScale.nombre}
              {entryScale.opciones.length ? <select className='form-select' required name='opcion_token' defaultValue=''>{options(entryScale.opciones, choose)}</select>
                : <input className='form-control' type='number' name='valor' required step={10 ** -entryScale.decimales} min={entryScale.minimo} max={entryScale.maximo}/>}</label>}
            {action.kind === 'revoke' && <label className='form-label d-block'>{t('Motivo de revocación', 'Reason for revocation')}
              <textarea className='form-control' name='motivo' required maxLength={1500}/></label>}
            {controls(action.kind === 'register' ? (row.es_rectificacion ? t('Guardar rectificación', 'Save correction') : t('Guardar definitiva', 'Save final grade')) : t('Confirmar revocación', 'Confirm revocation'))}
          </form>}
        </article>)}
        {!data.autorizaciones.length && <p className='text-muted mt-3'>{t('Sin autorizaciones individuales.', 'No individual authorizations yet.')}</p>}
      </>}
    </div>}
  </section>
}
