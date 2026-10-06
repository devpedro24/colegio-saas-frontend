import {useState, type FormEvent} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useDuplicarAnoLectivo, useResumenDuplicacionAno} from '../anos-lectivos.api'
import type {AnoLectivo} from '../anos-lectivos.types'
import './year-dialog.css'

export const options = ['jornadas', 'niveles', 'grados', 'grupos', 'bloques', 'espacios', 'areas',
  'materias', 'escalas', 'metodos', 'modelos', 'siee', 'curriculo', 'periodos', 'asistencia', 'aulas'] as const

const nextDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const next = new Date(Date.UTC(year + 1, month - 1, day))
  if (next.getUTCMonth() !== month - 1) next.setUTCDate(0)
  return next.toISOString().slice(0, 10)
}

function DuplicarForm({source, onClose}: {source: AnoLectivo; onClose: () => void}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const duplicate = useDuplicarAnoLectivo()
  const preview = useResumenDuplicacionAno(source.id)
  const [name, setName] = useState(source.tipo_calendario === 'A'
    ? String(Number(source.nombre) + 1)
    : source.nombre.split('-').map(part => String(Number(part) + 1)).join('-'))
  const [calendar, setCalendar] = useState(source.tipo_calendario)
  const [start, setStart] = useState(nextDate(source.fecha_inicio))
  const [end, setEnd] = useState(nextDate(source.fecha_fin))
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(options.map(key => [key, key !== 'aulas'])))
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    duplicate.mutate({id: source.id, input: {
      nombre: name.trim(), tipo_calendario: calendar, fecha_inicio: start, fecha_fin: end,
      num_periodos: source.num_periodos, periodo_sumatorio: source.periodo_sumatorio,
      opciones: selected,
    }}, {
      onSuccess: () => {toast.success(t('academico.anos.duplicate.success')); onClose()},
      onError: err => setError(err instanceof ApiError ? err.message : t('common.toast.genericError')),
    })
  }

  return <form onSubmit={submit}>
    <Modal.Body>
      <p className='text-muted'>{t('academico.anos.duplicate.help')}</p>
      {error && <div className='alert alert-danger' role='alert'>{error}</div>}
      <div className='row g-4 mb-6'>
        <div className='col-md-6'><label className='form-label required'>{t('academico.anos.field.nombre')}</label>
          <input className='form-control' required value={name} onChange={e => setName(e.target.value)} /></div>
        <div className='col-md-6'><label className='form-label required'>{t('academico.anos.field.calendario')}</label>
          <select className='form-select' value={calendar} onChange={e => setCalendar(e.target.value as 'A' | 'B')}>
            <option value='A'>{t('academico.anos.calendario.A')}</option><option value='B'>{t('academico.anos.calendario.B')}</option>
          </select></div>
        <div className='col-md-6'><label className='form-label required'>{t('academico.anos.field.fechaInicio')}</label>
          <input className='form-control' type='date' required value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className='col-md-6'><label className='form-label required'>{t('academico.anos.field.fechaFin')}</label>
          <input className='form-control' type='date' required min={start} value={end} onChange={e => setEnd(e.target.value)} /></div>
      </div>
      <h5>{t('academico.anos.duplicate.copy')}</h5>
      <div className='row g-4'>
        {options.map(key => <div className='col-md-6' key={key}><label className='d-flex align-items-center gap-3 rounded border p-4 h-100 cursor-pointer'>
          <input className='form-check-input me-2' type='checkbox' checked={selected[key]}
            onChange={e => setSelected(current => ({...current, [key]: e.target.checked}))} />
          <span className='form-check-label'>{t(`academico.anos.duplicate.option.${key}`)}</span>
        </label></div>)}
      </div>
      <p className='text-muted fs-7 mt-5 mb-0'>{t('academico.anos.duplicate.dependencies')}</p>
      <p className='text-muted fs-7'>{t('academico.anos.duplicate.excluded')}</p>
      {preview.data && <div className='alert alert-light-info mt-5' role='status'>
        <strong>Contenido reutilizable del año origen</strong><br />
        Política de asistencia: {preview.data.politica_asistencia ? 'configurada' : 'sin configurar'}.
        {' '}Aulas: {preview.data.aulas}; secciones: {preview.data.secciones}; recursos: {preview.data.recursos};
        {' '}preguntas: {preview.data.preguntas}; archivos de apoyo: {preview.data.adjuntos_apoyo}.
        <div className='mt-2'>Solo se copiarán los apartados seleccionados. No se trasladan matrículas,
          entregas, intentos, asistencias ni notas; los recursos copiados quedarán ocultos para estudiantes.</div>
      </div>}
    </Modal.Body>
    <Modal.Footer>
      <button type='button' className='btn btn-light' onClick={onClose}>{t('common.cancel')}</button>
      <button type='submit' className='btn btn-primary' disabled={duplicate.isPending}>{t('academico.anos.duplicate.action')}</button>
    </Modal.Footer>
  </form>
}

export function DuplicarAnoLectivoDialog({source, onClose}: {source: AnoLectivo | null; onClose: () => void}) {
  const intl = useIntl()
  return <Modal show={!!source} onHide={onClose} centered scrollable size='lg' dialogClassName='academic-year-dialog'>
    <Modal.Header closeButton><Modal.Title>{intl.formatMessage({id: 'academico.anos.duplicate.title'})}</Modal.Title></Modal.Header>
    {source && <DuplicarForm key={source.id} source={source} onClose={onClose} />}
  </Modal>
}
