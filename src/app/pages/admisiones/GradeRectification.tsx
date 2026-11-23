import {useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import type {Result, T} from './ExternalGrades'

type Props = {result: Pick<Result, 'token' | 'version' | 'decision' | 'rectificaciones'>; label: string; path: string; allowed: boolean; maxBytes: number; refresh: () => Promise<unknown>; t: T}

export function GradeRectification({result, label, path, allowed, maxBytes, refresh, t}: Props) {
  const [version, setVersion] = useState<number | null>(null)
  const toast = useToast()
  const endpoint = path + '/' + result.token + '/rectificaciones'
  const save = useMutation({mutationFn: (fields: FormData) => api.post(endpoint, fields),
    onSuccess: async () => {
      setVersion(null)
      toast.success(t('Definitiva rectificada.', 'Final grade corrected.'), 'updated')
      await refresh()
    },
    onError: error => {if (error instanceof ApiError && error.status === 409) void refresh()},
  })
  if (!result.decision) return null
  const scale = result.decision.siee
  const history = result.rectificaciones ?? []
  return <div className='mt-2'>
    {history.length > 0 && <details><summary>{t('Historial de rectificaciones', 'Correction history')} ({history.length})</summary>
      <ol className='mt-2'>{history.map(change => <li key={change.version} className='mb-3'>
        <strong>{change.anterior.categoria ?? change.anterior.valor} → {change.nueva.categoria ?? change.nueva.valor}</strong>
        <div>{t('Aprobación anterior', 'Previous approval')} · {change.anterior.responsable} · {change.aprobacion_anterior.slice(0,10)}</div>
        <div>{t('Rectificación', 'Correction')} · {change.nueva.responsable} · {change.registrado_en.slice(0,10)}</div>
        <div>{change.motivo}</div><a href={'/api' + endpoint + '/' + change.archivo_token} download>{change.archivo_nombre}</a>
      </li>)}</ol></details>}
    {allowed && (version === null ? <button type='button' className='btn btn-sm btn-light-primary' onClick={() => {save.reset(); setVersion(result.version)}}>
      {label}</button> : <form className='mt-2' onSubmit={e => {
        e.preventDefault()
        const fields = new FormData(e.currentTarget)
        fields.set('version', String(version))
        if (!save.isPending) save.mutate(fields)
      }}><fieldset disabled={save.isPending}><legend className='fs-6'>{label} · {result.decision.materia} · {result.decision.periodo}</legend>
        <label className='form-label d-block'>{t('Nueva definitiva', 'New final grade')} · {scale.nombre}
          {scale.opciones.length ? <select name='opcion_token' className='form-select' required defaultValue=''><option value=''>{t('Selecciona', 'Select')}</option>
            {scale.opciones.map(o => <option value={o.token} key={o.token}>{o.nombre}</option>)}</select>
            : <input name='valor' className='form-control' type='number' min={scale.minimo} max={scale.maximo} step={10 ** -scale.decimales} required/>}</label>
        <label className='form-label d-block'>{t('Motivo de la rectificación', 'Reason for correction')}<textarea className='form-control' name='motivo' required maxLength={1500}/></label>
        <label className='form-label d-block'>{t('Soporte de la rectificación (PDF, JPG o PNG)', 'Supporting document (PDF, JPG or PNG)')}
          <input name='soporte' type='file' className='form-control' accept='.pdf,.jpg,.jpeg,.png' required onChange={e => {
            const file = e.currentTarget.files?.[0]
            e.currentTarget.setCustomValidity(file && file.size > maxBytes ? t('El archivo supera el tamaño permitido.', 'File exceeds the upload limit.') : '')
          }}/></label>
        {save.error && <p role='alert' className='text-danger'>{save.error.message}</p>}
        {version !== result.version && <p role='status'>{t('La definitiva cambió. Cancela y vuelve a abrir la rectificación para revisar su valor.', 'The grade changed. Cancel and reopen the correction to review it.')}</p>}
        <div className='d-flex flex-wrap gap-2'><button type='button' className='btn btn-sm btn-light' onClick={() => setVersion(null)}>{t('Cancelar', 'Cancel')}</button>
          <button type='submit' className='btn btn-sm btn-primary' disabled={version !== result.version}>{t('Confirmar rectificación', 'Confirm correction')}</button></div>
      </fieldset></form>)}
  </div>
}
