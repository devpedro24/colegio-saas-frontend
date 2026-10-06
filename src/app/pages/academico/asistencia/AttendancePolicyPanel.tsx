import {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAnosLectivos} from '../anos-lectivos/anos-lectivos.api'
import {useAttendancePolicy, useSaveAttendancePolicy} from './asistencia.api'

export function AttendancePolicySettings() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const yearsQuery = useAnosLectivos()
  const [selected, setSelected] = useState('')
  const years = yearsQuery.data?.data ?? []
  const year = selected || years.find(item => item.estado === 'en_curso')?.url_token || years[0]?.url_token || ''

  return <section className='mb-6'>
    {yearsQuery.isError && <div role='alert' className='alert alert-danger'>{t('attendance.yearsError')}</div>}
    {years.length > 0 && <>
      <div className='d-flex align-items-center gap-3 mb-3'>
        <label htmlFor='attendance-policy-year' className='form-label mb-0'>{t('attendance.policyYear')}</label>
        <select id='attendance-policy-year' className='form-select w-auto' value={year}
          onChange={event => setSelected(event.target.value)}>
          {years.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
        </select>
      </div>
      <AttendancePolicyPanel key={year} year={year} readOnly={['cerrado', 'archivado'].includes(years.find(item => item.url_token === year)?.estado ?? '')} />
    </>}
  </section>
}

function AttendancePolicyPanel({year, readOnly}: {year: string; readOnly: boolean}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const query = useAttendancePolicy(year)
  const save = useSaveAttendancePolicy(year)
  const [count, setCount] = useState('')
  const [percent, setPercent] = useState('')
  const [combination, setCombination] = useState<'cualquiera' | 'ambos'>('cualquiera')
  const [scope, setScope] = useState<'periodo' | 'anual'>('periodo')
  const [late, setLate] = useState('0')
  const [dirty, setDirty] = useState(false)
  const [draftVersion, setDraftVersion] = useState<number | null>(null)

  useEffect(() => {
    if (!query.data || dirty) return
    setCount(query.data.max_faltas == null ? '' : String(query.data.max_faltas))
    setPercent(query.data.max_porcentaje == null ? '' : String(query.data.max_porcentaje))
    setCombination(query.data.combinacion)
    setScope(query.data.ambito)
    setLate(String(query.data.tardes_por_falta))
  }, [query.data, dirty])

  const markDirty = () => {if (!dirty) setDraftVersion(query.data?.version ?? 0); setDirty(true)}
  const update = (setter: (value: string) => void, value: string) => {setter(value); markDirty()}
  const stale = dirty && draftVersion !== query.data?.version
  const valid = (count === '' || (/^\d+$/.test(count) && Number(count) <= 1000)) &&
    (percent === '' || (/^\d+(\.\d{0,2})?$/.test(percent) && Number(percent) <= 100)) &&
    /^\d+$/.test(late) && Number(late) <= 100

  return <section className='card mb-6'><div className='card-body'>
    <h3 className='fs-5 fw-bold'>{t('attendance.policyTitle')}</h3>
    <p className='text-muted'>{t('attendance.policyHelp')}{readOnly ? ` ${t('attendance.closedYear')}` : ''}</p>
    {query.isError && <div role='alert' className='alert alert-danger'>{t('attendance.policyLoadError')}</div>}
    {query.data && <>
      {stale && <div role='alert' className='alert alert-warning d-flex justify-content-between align-items-center gap-3'>
        <span>{t('attendance.policyStale')}</span>
        <button type='button' className='btn btn-sm btn-light' onClick={() => {setDirty(false); setDraftVersion(null)}}>{t('attendance.reload')}</button>
      </div>}
      <div className='row g-3'>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-max-count'>{t('attendance.maxCount')}</label>
          <input id='attendance-max-count' type='number' min='0' max='1000' className='form-control' value={count}
            onChange={event => update(setCount, event.target.value)} /></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-max-percent'>{t('attendance.maxPercent')}</label>
          <input id='attendance-max-percent' type='number' min='0' max='100' step='0.01' className='form-control' value={percent}
            onChange={event => update(setPercent, event.target.value)} /></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-combination'>{t('attendance.combination')}</label>
          <select id='attendance-combination' className='form-select' value={combination}
            onChange={event => {setCombination(event.target.value as 'cualquiera' | 'ambos'); markDirty()}}>
            <option value='cualquiera'>{t('attendance.anyThreshold')}</option>
            <option value='ambos'>{t('attendance.bothThresholds')}</option>
          </select></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-scope'>{t('attendance.scope')}</label>
          <select id='attendance-scope' className='form-select' value={scope}
            onChange={event => {setScope(event.target.value as 'periodo' | 'anual'); markDirty()}}>
            <option value='periodo'>{t('attendance.period')}</option>
            <option value='anual'>{t('attendance.year')}</option>
          </select></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-late'>{t('attendance.lateEquivalent')}</label>
          <input id='attendance-late' type='number' min='0' max='100' className='form-control' value={late}
            onChange={event => update(setLate, event.target.value)} /></div>
      </div>
      <div className='d-flex justify-content-end mt-4'>
        <button type='button' className='btn btn-primary' disabled={readOnly || !dirty || stale || !valid || save.isPending}
          onClick={() => save.mutate({
            max_faltas: count === '' ? null : Number(count), max_porcentaje: percent === '' ? null : percent,
            combinacion: combination, ambito: scope, tardes_por_falta: Number(late), version: draftVersion ?? query.data!.version,
          }, {
            onSuccess: () => {setDirty(false); setDraftVersion(null); toast.success(t('attendance.policySaved'))},
            onError: error => toast.error(error instanceof ApiError ? error.message : t('attendance.policySaveError')),
          })}>{t('attendance.savePolicy')}</button>
      </div>
    </>}
  </div></section>
}
