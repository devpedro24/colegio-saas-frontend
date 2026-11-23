import {useState, type FormEvent} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useEnrollmentScope} from './enrollmentSettings.api'
import {EarlyPromotion, type PromotionData} from './EarlyPromotion'

type Evidence = {token: string; nombre: string; motivo: string; responsable: string; registrado_en: string}
type Movement = {version: number; origen: string; destino: string; motivo: string; responsable: string; fecha_efectiva: string; registrado_en: string;
  rectifica_version: number | null; promocion_anticipada?: boolean; soportes: Evidence[]}
type Action = {kind: 'corregir'} | {kind: 'rectificar' | 'adjuntar'; movement: Movement}
export type Trajectory = {version: number; desde: string; hasta: string; puede_corregir: boolean; puede_rectificar: boolean; puede_ver_notas: boolean; max_soporte_bytes: number;
  tiene_resultados_traslado?: boolean; promocion_anticipada?: PromotionData | null; movimientos: Movement[]; destinos: {token: string; nombre: string}[]; resumen: Record<string, number>}
type Grade = {materia: string; actividad: string; periodo: string; grado: string; grupo: string; fecha: string; valor: string; categoria: string | null}

export function EnrollmentTrajectory({token, trajectory}: {token: string; trajectory: Trajectory}) {
  const intl = useIntl()
  const en = intl.locale.startsWith('en')
  const t = (es: string, english: string) => en ? english : es
  const cache = useQueryClient()
  const scope = useEnrollmentScope()
  const toast = useToast()
  const [editing, setEditing] = useState<Action | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const attaching = editing?.kind === 'adjuntar'
  const rectifying = editing?.kind === 'rectificar'
  const fileError = files.length > 5 ? t('Selecciona hasta cinco archivos por envío.', 'Select up to five files per upload.')
    : files.some(file => !/\.(pdf|jpe?g|png)$/i.test(file.name)) ? t('Selecciona documentos PDF o imágenes JPG o PNG.', 'Select PDF documents or JPG or PNG images.')
    : files.some(file => file.size > trajectory.max_soporte_bytes) ? t('Un archivo supera el tamaño permitido.', 'A file exceeds the size limit.') : ''
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState(trajectory.hasta)
  const [reason, setReason] = useState('')
  const [version, setVersion] = useState(trajectory.version)
  const [page, setPage] = useState(0)
  const grades = useQuery({queryKey: ['matriculas', scope, 'notas', token, page], enabled: page > 0 && trajectory.puede_ver_notas,
    queryFn: () => api.get<{data: Grade[]; hay_mas: boolean}>(`/matriculas/${token}/notas-de-actividades?page=${page}`)})
  const correction = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error(t('Selecciona una actuación.', 'Select an action.'))
      const payload = editing.kind === 'adjuntar' ? {movimiento_version: editing.movement.version, motivo: reason.trim()}
        : {grupo_token: destination, motivo: reason.trim(), fecha_efectiva: date, version,
           ...(editing.kind === 'rectificar' && {rectifica_version: editing.movement.version})}
      const path = `/matriculas/${token}/${attaching ? 'soportes' : 'correcciones'}`
      if (!files.length) return api.post(path, payload)
      const form = new FormData()
      for (const [key, value] of Object.entries(payload)) form.append(key, String(value))
      for (const file of files) form.append('soportes[]', file)
      return api.post(path, form)
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) {
        void cache.invalidateQueries({queryKey: ['matriculas', scope, 'ficha', token]})
      }
    },
    onSuccess: async () => {
      setEditing(null)
      setFiles([])
      toast.success(attaching ? t('Soportes guardados.', 'Documents attached.') : rectifying
        ? t('Rectificación registrada.', 'Amendment recorded.') : t('Corrección registrada.', 'Correction recorded.'), 'updated')
      await Promise.all(['matriculas', 'ingreso', 'evaluacion', 'asistencias', 'boletines', 'aula', 'opciones-academicas'].map(key => cache.invalidateQueries({queryKey: [key]})))
    },
  })
  const begin = (action: Action) => {
    setFiles([])
    correction.reset()
    setVersion(trajectory.version)
    setDate(trajectory.hasta)
    setDestination('')
    setReason('')
    setEditing(action)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (reason.trim() && !fileError && (!attaching || files.length > 0) && !correction.isPending) correction.mutate()
  }
  const countLabels: Record<string, string> = {notas: t('Notas de actividades', 'Activity grades'), asistencias: t('Registros de asistencia', 'Attendance records'),
    entregas: t('Entregas', 'Submissions'), observaciones: t('Observaciones', 'Observations'), boletines: t('Boletines', 'Report cards'),
    recuperaciones: t('Recuperaciones', 'Remedial assessments'), resultados_manuales: t('Resultados manuales', 'Manual results')}
  return <section className='border-top pt-5 mt-5'>
    <div className='d-flex flex-wrap justify-content-between align-items-center gap-3'>
      <h4 className='mb-0'>{t('Trayectoria académica', 'Academic history')}</h4>
      {trajectory.puede_corregir && !editing && <button type='button' className='btn btn-sm btn-light-primary' onClick={() => begin({kind: 'corregir'})}>
        {t('Corregir grado o grupo', 'Correct grade or group')}</button>}
    </div>
    <dl className='row row-cols-2 row-cols-md-4 g-3 my-3'>
      {Object.entries(trajectory.resumen).map(([key, count]) => <div key={key}><dt className='text-muted fw-normal'>{countLabels[key]}</dt><dd className='fw-semibold'>{count}</dd></div>)}
    </dl>
    {trajectory.promocion_anticipada && <EarlyPromotion key={token} token={token} data={trajectory.promocion_anticipada} version={trajectory.version} since={trajectory.desde} maxBytes={trajectory.max_soporte_bytes} />}
    {editing && <form className='card card-body bg-light mb-4' onSubmit={submit}>
      <fieldset disabled={correction.isPending}>
        {editing.kind !== 'corregir' && <div className='mb-4'><h5>{attaching ? t('Adjuntar soportes', 'Attach documents') : t('Rectificar movimiento', 'Amend placement change')}</h5>
          <div>#{editing.movement.version} · {editing.movement.origen} → {editing.movement.destino} · {editing.movement.fecha_efectiva}</div>
          {rectifying && <div>{t('Grupo vigente', 'Current group')} · {trajectory.movimientos[0]?.destino}</div>}</div>}
        {!attaching && <><p>{t('Las notas y asistencias conservan el grupo en el que se registraron.', 'Grades and attendance retain their original group.')}</p>
          <div className='row g-3 mb-3'><div className='col-md-8'><label className='form-label' htmlFor='trajectory-group'>{t('Grado y grupo de destino', 'Destination grade and group')}</label>
            <select autoFocus id='trajectory-group' className='form-select' required value={destination} onChange={e => setDestination(e.target.value)}>
              <option value=''>{t('Selecciona el destino', 'Select destination')}</option>
              {trajectory.destinos.map(g => <option key={g.token} value={g.token}>{g.nombre}</option>)}</select></div>
            <div className='col-md-4'><label className='form-label' htmlFor='trajectory-date'>{t('Fecha efectiva', 'Effective date')}</label>
              <input id='trajectory-date' type='date' className='form-control' required min={trajectory.desde} max={trajectory.hasta} value={date} onChange={e => setDate(e.target.value)} /></div></div>
          <p className='text-muted'>{t('Al cambiar de grado, las definitivas de los periodos cerrados se conservan para las materias comunes. Las materias nuevas quedan pendientes de valoración.', 'When the grade changes, final grades for closed terms carry over for shared subjects. New subjects await assessment.')}</p>
          {!trajectory.destinos.length && <p role='status'>{t('No hay otro grupo activo en esta sede y año.', 'There are no other active groups at this campus for this year.')}</p>}</>}
        <label className='form-label' htmlFor='trajectory-reason'>{attaching ? t('Motivo del anexo', 'Reason for attachment') : t('Motivo de la corrección', 'Reason for correction')}</label>
        <textarea autoFocus={attaching} id='trajectory-reason' className='form-control mb-3' rows={2} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />
        <label className='form-label' htmlFor='trajectory-files'>{attaching ? t('Soportes', 'Documents') : t('Soportes (opcional)', 'Documents (optional)')}</label>
        <input id='trajectory-files' type='file' multiple required={attaching} accept='.pdf,.jpg,.jpeg,.png' className='form-control'
          aria-describedby='trajectory-file-help' onChange={e => setFiles(Array.from(e.target.files ?? []))} />
        <small id='trajectory-file-help'>{t('Hasta 5 archivos PDF, JPG o PNG por envío.', 'Up to 5 PDF, JPG or PNG files per upload.')} {intl.formatNumber(trajectory.max_soporte_bytes / 1048576)} MB {t('por archivo.', 'per file.')}</small>
        {fileError && <p className='text-danger' role='alert'>{fileError}</p>}
        {correction.error && <p className='text-danger my-3' role='alert'>{correction.error.message}</p>}
        <div className='d-flex flex-wrap justify-content-end gap-2 mt-4'><button type='button' className='btn btn-sm btn-light' onClick={() => setEditing(null)}>{t('Cancelar', 'Cancel')}</button>
          <button type='submit' className='btn btn-sm btn-primary' disabled={!reason.trim() || !!fileError || (attaching ? !files.length : !destination || trajectory.version !== version)}>
            {attaching ? t('Guardar soportes', 'Save documents') : rectifying ? t('Confirmar rectificación', 'Confirm amendment') : t('Confirmar corrección', 'Confirm correction')}</button></div>
      </fieldset>
    </form>}
    {trajectory.movimientos.length > 0 ? <ol className='list-unstyled'>{trajectory.movimientos.map(m => {
      const amendment = trajectory.movimientos.find(next => next.rectifica_version === m.version)
      const canAttach = m.rectifica_version ? trajectory.puede_rectificar : trajectory.puede_corregir
      return <li className='border-bottom py-3' key={m.version}>
        <strong>#{m.version} · {m.origen} → {m.destino}</strong>
        {m.rectifica_version && <div>{t('Rectifica el movimiento', 'Amends change')} #{m.rectifica_version}</div>}
        {amendment && <div>{t('Rectificado por el movimiento', 'Amended by change')} #{amendment.version}</div>}
        <div>{t('Fecha efectiva', 'Effective date')} · {m.fecha_efectiva}</div><div className='text-break'>{m.motivo}</div>
        <small>{m.responsable} · {t('Registrado', 'Recorded')} {intl.formatDate(new Date(m.registrado_en), {dateStyle: 'medium', timeStyle: 'short'})}</small>
        {m.soportes?.length > 0 && <ul className='mt-2'>{m.soportes.map(file => <li key={file.token} className='text-break'>
          <a href={`/api/matriculas/${token}/soportes/${file.token}`} download>{file.nombre}</a>
          <small className='d-block'>{file.motivo} · {file.responsable} · {intl.formatDate(new Date(file.registrado_en), {dateStyle: 'medium', timeStyle: 'short'})}</small></li>)}</ul>}
        {!editing && <div className='d-flex flex-wrap gap-2 mt-2'>
          {!amendment && !m.promocion_anticipada && trajectory.puede_rectificar && <button type='button' className='btn btn-sm btn-light-primary' onClick={() => begin({kind: 'rectificar', movement: m})}>{t('Rectificar', 'Amend')}</button>}
          {canAttach && <button type='button' className='btn btn-sm btn-light' onClick={() => begin({kind: 'adjuntar', movement: m})}>{t('Adjuntar soportes', 'Attach documents')}</button>}</div>}
      </li>
    })}</ol>
      : <p className='text-muted'>{t('Aún no hay correcciones registradas.', 'No corrections recorded yet.')}</p>}
    {trajectory.puede_ver_notas && trajectory.resumen.notas > 0 && <button type='button' className='btn btn-sm btn-light' aria-expanded={page > 0} onClick={() => setPage(page ? 0 : 1)}>
      {page ? t('Ocultar notas', 'Hide grades') : t('Ver notas por grupo de origen', 'View grades by original group')}</button>}
    {page > 0 && <div aria-live='polite'>
      {grades.isPending && <p>{t('Cargando notas…', 'Loading grades…')}</p>}{grades.error && <p role='alert'>{grades.error.message}</p>}
      <ul className='list-unstyled'>{grades.data?.data.map((g,i) => <li className='border-bottom py-2' key={i}><strong>{g.materia} · {g.actividad} · {g.categoria ?? intl.formatNumber(Number(g.valor))}</strong>
        <div>{g.grado} / {g.grupo} · {g.periodo} · {g.fecha}</div></li>)}</ul>
      {(page > 1 || grades.data?.hay_mas) && <div className='d-flex gap-2'>
        <button type='button' className='btn btn-light btn-sm' disabled={page === 1} onClick={() => setPage(page-1)}>{t('Anterior', 'Previous')}</button>
        <button type='button' className='btn btn-light btn-sm' disabled={!grades.data?.hay_mas} onClick={() => setPage(page+1)}>{t('Siguiente', 'Next')}</button></div>}
    </div>}
  </section>
}
