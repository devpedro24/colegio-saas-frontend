import {NumberInput} from '@/app/shared/components/NumberInput'
import {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {useEscalas, useUpdateEscala} from '../configuracion.api'
import type {EscalaValorativa, PerformanceRange} from '../configuracion.types'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'

export function PerformanceRangeEditor({value, onChange, disabled = false, readOnly = false}: {
  value: PerformanceRange[]; onChange: (value: PerformanceRange[]) => void; disabled?: boolean; readOnly?: boolean
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  return <fieldset disabled={disabled} className='border rounded-3 p-5 mt-5'>
    <legend className='float-none w-auto fs-5 fw-bold px-2'>{t('siee.performance.title')}</legend>
    <p className='fs-7 mb-4'>{t('siee.performance.help')}</p>
    {value.length === 0 && <div className='alert alert-warning mb-4' role='status'>{t('siee.performance.empty')}</div>}
    {readOnly && value.length > 0 && <div className='table-responsive'><table className='table align-middle mb-0'>
      <thead><tr><th>{t('common.name')}</th><th>{t('siee.performance.desde')}</th><th>{t('siee.performance.hasta')}</th></tr></thead>
      <tbody>{[...value].sort((a, b) => Number(b.desde) - Number(a.desde)).map((row, index) => <tr key={index}>
        <td className='fw-semibold'>{row.nombre}</td>
        <td>{intl.formatNumber(Number(row.desde), {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td>
        <td>{intl.formatNumber(Number(row.hasta), {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td>
      </tr>)}</tbody>
    </table></div>}
    {!readOnly && value.map((row, index) => <div className='row g-3 align-items-end mb-4' key={index}>
      <div className='col-sm-5'><label className='form-label'>{t('common.name')}</label>
        <input className='form-control' maxLength={60} value={row.nombre} required
          onChange={event => onChange(value.map((item, i) => i === index ? {...item, nombre: event.target.value} : item))} /></div>
      {(['desde', 'hasta'] as const).map(key => <div className='col-4 col-sm-2' key={key}>
        <label className='form-label'>{t(`siee.performance.${key}`)}</label>
        <NumberInput className='form-control' type='number' step='0.1' required value={row[key]}
          onChange={event => onChange(value.map((item, i) => i === index ? {...item, [key]: event.target.value} : item))} /></div>)}
      <div className='col-4 col-sm-3'><button type='button' className='btn btn-light-danger' onClick={() => onChange(value.filter((_, i) => i !== index))}>{t('grading.delete')}</button></div>
    </div>)}
    {!readOnly && <button type='button' className='btn btn-light-primary' disabled={disabled || value.length >= 8}
      onClick={() => onChange([...value, {nombre: '', desde: '', hasta: ''}])}>{t('siee.performance.add')}</button>}
    <p className='fs-7 mt-3 mb-0'>{t('siee.performance.coverage')}</p>
  </fieldset>
}

function ScaleRanges({scale, year, editable}: {scale: EscalaValorativa; year: string; editable: boolean}) {
  const intl = useIntl(), toast = useToast(), mutation = useUpdateEscala(year)
  const [ranges, setRanges] = useState(scale.desempenos ?? [])
  useEffect(() => setRanges(scale.desempenos ?? []), [scale])
  return <form onSubmit={async event => {
    event.preventDefault()
    try {
      await mutation.mutateAsync({id: scale.url_token, input: {ano_lectivo_token: year, nombre: scale.nombre,
        nivel_educativo: scale.nivel_educativo, tipo: scale.tipo, valor_min: scale.valor_min, valor_max: scale.valor_max,
        decimales: 1, desempenos: ranges}})
      toast.success(intl.formatMessage({id: 'common.toast.updated'}), 'updated')
    } catch (error) {toast.error(error instanceof ApiError ? Object.values(error.errors ?? {}).flat()[0] ?? error.message
      : error instanceof Error ? error.message : intl.formatMessage({id: 'common.toast.saveError'}))}
  }}>
    <p className='fw-semibold mb-0'>{scale.nombre}</p>
    <PerformanceRangeEditor value={ranges} onChange={setRanges} disabled={!editable || mutation.isPending} readOnly={!editable} />
    {!editable && <div className='alert alert-warning mt-4 mb-0' role='status'>{intl.formatMessage({id: 'siee.performance.readOnly'})}</div>}
    {editable && <div className='text-end mt-3'><button className='btn btn-primary' disabled={mutation.isPending}>{intl.formatMessage({id: 'siee.performance.save'})}</button></div>}
  </form>
}

export function PerformanceSettingsCard({year, token, editable}: {year: string; token: string | null; editable: boolean}) {
  const query = useEscalas(year)
  const intl = useIntl()
  if (query.isPending) return <div className='card card-body mb-6' role='status'>{intl.formatMessage({id: 'common.pleaseWait'})}</div>
  if (query.isError) return <div className='alert alert-danger' role='alert'>{query.error.message}</div>
  const scale = query.data?.data.find(row => row.url_token === token)
  if (!scale || scale.tipo !== 'numerica') return null
  return <div className='card card-body mb-6'><ScaleRanges key={scale.url_token} scale={scale} year={year} editable={editable} /></div>
}
