import {useState} from 'react'
import {useMutation} from '@tanstack/react-query'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import type {T} from './ExternalGrades'

type Source = 'colegio' | 'certificado'
type Grades = Record<Source, string>
type Choice = Grades & {version: number; fuente: Source; motivo: string; responsable: string; registrado_en: string}
export type SourceComparison = Grades & {fuente: Source | null; historica?: boolean; huella: string; version: number; historial: Choice[]}

export function GradeSourceChoice({comparison, allowed, path, refresh, t}: {
  comparison: SourceComparison; allowed: boolean; path: string; refresh: () => Promise<unknown>; t: T
}) {
  const [editing, setEditing] = useState(false)
  const toast = useToast()
  const labels: Record<Source, string> = {colegio: t('Colegio', 'School'), certificado: t('Certificado', 'Certificate')}
  const save = useMutation({
    mutationFn: (data: FormData) => api.post(path, {fuente: data.get('fuente'), motivo: String(data.get('motivo')).trim(),
      version: comparison.version, huella: comparison.huella}),
    onSuccess: async () => {setEditing(false); toast.success(t('Elección registrada.', 'Choice recorded.'), 'updated'); await refresh()},
    onError: async error => {if (error instanceof ApiError && error.status === 409) {setEditing(false); await refresh()}},
  })
  return <section className='border rounded p-3 my-3'>
    <h5>{t('Definitiva que cuenta', 'Effective final grade')}</h5>
    <div className='d-flex flex-wrap gap-4 mb-2'>
      <span>{labels.colegio} · <b>{comparison.colegio}</b></span>
      <span>{labels.certificado} · <b>{comparison.certificado}</b></span>
    </div>
    <p role='status'>{comparison.historica ? t('Fuente vigente al cierre · Certificado', 'Source at closure · Certificate') : comparison.fuente ? t('Fuente elegida', 'Selected source') + ' · ' + labels[comparison.fuente]
      : t('Pendiente de elección del colegio.', 'Awaiting the school’s choice.')}</p>
    {allowed && !editing && <button type='button' className='btn btn-sm btn-light-primary' onClick={() => setEditing(true)}>
      {comparison.fuente ? t('Cambiar elección', 'Change selection') : t('Elegir definitiva', 'Choose final grade')}</button>}
    {allowed && editing && <form onSubmit={e => {e.preventDefault(); if (!save.isPending) save.mutate(new FormData(e.currentTarget))}}>
      <fieldset disabled={save.isPending}><legend className='fs-6'>{t('¿Cuál debe contar en este periodo?', 'Which grade counts for this term?')}</legend>
        <div className='d-flex flex-wrap gap-4'>{(['colegio', 'certificado'] as const).map(source =>
          <label key={source}><input type='radio' name='fuente' value={source} required className='me-2'/>{labels[source]} · {comparison[source]}</label>)}</div>
        <label className='form-label d-block mt-3'>{t('Motivo de la elección', 'Reason for the choice')}
          <textarea name='motivo' className='form-control' required maxLength={1500} onInput={e => e.currentTarget.setCustomValidity(e.currentTarget.value.trim() ? '' : t('Escribe el motivo.', 'Enter a reason.'))}/></label>
        <button type='submit' className='btn btn-sm btn-primary me-2'>{t('Guardar elección', 'Save choice')}</button>
        <button type='button' className='btn btn-sm btn-light' onClick={() => setEditing(false)}>{t('Cancelar', 'Cancel')}</button>
      </fieldset></form>}
    {save.error && <p role='alert' className='text-danger'>{save.error.message}</p>}
    {comparison.historial.length > 0 && <details className='mt-3'><summary>{t('Historial de elecciones', 'Choice history')}</summary>
      <ol className='mt-2'>{comparison.historial.map(c => <li key={c.version}>
        <strong>{labels[c.fuente]} · {c[c.fuente]}</strong> — {c.responsable} · {c.registrado_en.slice(0,10)}
        <div>{labels.colegio} · {c.colegio} / {labels.certificado} · {c.certificado}</div><div>{c.motivo}</div>
      </li>)}</ol></details>}
  </section>
}
