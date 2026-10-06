import {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {Content} from '@/_metronic/layout/components/content'
import {PageTitle} from '@/_metronic/layout/core'
import {KTIcon} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'
import {usePreinformes, useGuardarPreinformes, type PeriodoPreinformes, type Preinforme} from './preinformes.api'

export default function PreinformesPage() {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const [year, setYear] = useState('')
  const query = usePreinformes(year)
  const [selected, setSelected] = useState('')
  const [dirty, setDirty] = useState(false)
  const periods = query.data?.periodos ?? []
  const period = periods.find(p => p.url_token === selected) ?? periods.find(p => p.estado === 'abierto') ?? periods[0]
  const leave = () => !dirty || window.confirm(t('grading.unsaved'))
  return <><PageTitle>{t('preinformes.title')}</PageTitle><Content>
    <div className='card'><div className='card-body'>
      <div className='d-flex flex-wrap align-items-start justify-content-between gap-4 mb-6'>
        <div><h2 className='fs-3 fw-bold'><KTIcon iconName='calendar-8' className='fs-2 me-2' />{t('preinformes.title')}</h2>
          <p className='text-muted mb-0'>{t('preinformes.help')}</p></div>
        <select className='form-select form-select-solid w-auto' aria-label={t('academico.config.yearLabel')}
          value={query.data?.ano?.url_token ?? year} onChange={e => {if (leave()) {setDirty(false); setSelected(''); setYear(e.target.value)}}}>
          {query.data?.anos.map(y => <option key={y.url_token} value={y.url_token}>{y.nombre}</option>)}
        </select>
      </div>
      {query.isPending && <p role='status'>{t('common.pleaseWait')}</p>}
      {query.error && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
      {query.data && !query.data.incluido_plan && <div className='alert alert-info'><KTIcon iconName='lock' className='fs-3 me-2' />{t('preinformes.plan')}</div>}
      {query.data && !periods.length && <div className='alert alert-light'>{t('preinformes.noPeriods')}</div>}
      <div className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-6 fw-semibold mb-6 gap-4'>{periods.map(p => <button key={p.url_token}
        type='button' aria-current={p === period ? 'page' : undefined}
        className={`nav-link pb-2 ${p === period ? 'active text-primary' : 'text-muted'}`}
        onClick={() => {if (leave()) {setDirty(false); setSelected(p.url_token)}}}>{p.nombre}</button>)}</div>
      {period && <PeriodEditor key={period.url_token} period={period} periods={periods}
        canEdit={!!query.data?.puede_gestionar && period.editable} onDirty={setDirty} />}
    </div></div>
  </Content></>
}

function PeriodEditor({period, periods, canEdit, onDirty}: {period: PeriodoPreinformes; periods: PeriodoPreinformes[]; canEdit: boolean; onDirty: (value: boolean) => void}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const save = useGuardarPreinformes()
  const [draft, setDraft] = useState(period); const [dirty, setDirty] = useState(false)
  useEffect(() => {if (!dirty) setDraft(period)}, [period, dirty])
  useEffect(() => {onDirty(dirty)}, [dirty, onDirty])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = ''}
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const change = (next: PeriodoPreinformes) => {setDraft(next); setDirty(true)}
  const config = (next: Partial<PeriodoPreinformes['configuracion']>) => change({...draft, configuracion: {...draft.configuracion, ...next}})
  const row = (index: number, next: Partial<Preinforme>) => change({...draft, preinformes: draft.preinformes.map((p, i) => i === index ? {...p, ...next} : p)})
  const total = draft.preinformes.reduce((sum, p) => sum + Number((p.peso ?? '0').replace(',', '.')), 0)
  return <div>
    <div className='d-flex flex-wrap justify-content-between align-items-center gap-4 mb-6'>
      <label className='form-check form-switch form-check-custom form-check-solid'>
        <input type='checkbox' className='form-check-input' disabled={!canEdit || save.isPending}
          checked={draft.configuracion.usar_preinformes} onChange={e => config({usar_preinformes: e.target.checked})} />
        <span className='form-check-label fw-semibold text-gray-800'>{t('preinformes.enable')}</span>
      </label>
      <select className='form-select form-select-solid w-auto mw-100' disabled={!canEdit || save.isPending} value=''
        aria-label={t('preinformes.copy')} onChange={e => {
          const source = periods.find(p => p.url_token === e.target.value)
          if (source) change({...draft, configuracion: {...source.configuracion, fechas_estrictas: false},
            preinformes: source.preinformes.map(p => ({...p, url_token: null, fecha_inicio: null, fecha_fin: null}))})
        }}><option value=''>{t('preinformes.copy')}</option>{periods.filter(p => p.url_token !== period.url_token && p.configuracion.usar_preinformes).map(p => <option key={p.url_token} value={p.url_token}>{p.nombre}</option>)}</select>
    </div>
    {!period.editable && <div className='alert alert-info'>{t('grading.closed')}</div>}
    {!draft.configuracion.usar_preinformes ? <p className='text-muted py-4'>{t('preinformes.direct')}</p> : <>
      <div className='row g-5 mb-6'>
        <div className='col-md-6'><label className='form-label required' htmlFor='preinformes-mode'>{t('preinformes.calculation')}</label>
          <select id='preinformes-mode' className='form-select' disabled={!canEdit || save.isPending} value={draft.configuracion.modo}
            onChange={e => config({modo: e.target.value as PeriodoPreinformes['configuracion']['modo']})}>
            <option value='SIMPLE_AVERAGE'>{t('grading.equal')}</option><option value='WEIGHTED_AVERAGE'>{t('grading.weighted')}</option>
          </select></div>
        <div className='col-md-6 d-flex align-items-end pb-3'><label className='form-check form-check-custom form-check-solid'>
          <input type='checkbox' className='form-check-input' checked={draft.configuracion.fechas_estrictas} disabled={!canEdit || save.isPending}
            onChange={e => config({fechas_estrictas: e.target.checked})} /><span className='form-check-label'>{t('preinformes.strict')}</span>
        </label></div>
      </div>
      <p className='text-muted fs-7'>{t('preinformes.datesHelp')}</p>
      {draft.preinformes.map((p, index) => <div className='border rounded-3 p-5 mb-5' key={p.url_token ?? `new-${index}`}>
        <div className='row g-4 align-items-end'>
          <div className='col-md-4'><label className='form-label required' htmlFor={`pre-name-${index}`}>{t('grading.name')}</label>
            <input id={`pre-name-${index}`} className='form-control' value={p.nombre} maxLength={120} disabled={!canEdit || save.isPending} onChange={e => row(index, {nombre: e.target.value})} /></div>
          {draft.configuracion.modo === 'WEIGHTED_AVERAGE' && <div className='col-md-2'><label className='form-label required' htmlFor={`pre-weight-${index}`}>{t('grading.weight')}</label>
            <input id={`pre-weight-${index}`} className='form-control' inputMode='decimal' value={p.peso ?? ''} disabled={!canEdit || save.isPending} onChange={e => row(index, {peso: e.target.value.replace(',', '.') || null})} /></div>}
          {(['fecha_inicio', 'fecha_fin'] as const).map(field => <div className='col-md-2' key={field}>
            <label className={`form-label ${draft.configuracion.fechas_estrictas ? 'required' : ''}`} htmlFor={`${field}-${index}`}>{t(`preinformes.${field}`)}{!draft.configuracion.fechas_estrictas && ` ${t('common.field.optional')}`}</label>
            <input id={`${field}-${index}`} type='date' className='form-control' min={period.fecha_inicio.slice(0, 10)} max={period.fecha_fin.slice(0, 10)}
              disabled={!canEdit || save.isPending} value={p[field] ?? ''} onChange={e => row(index, {[field]: e.target.value || null})} /></div>)}
          <div className='col-auto'><button type='button' className='btn btn-icon btn-light-danger' disabled={!canEdit || save.isPending}
            aria-label={t('grading.delete')} onClick={() => change({...draft, preinformes: draft.preinformes.filter((_, i) => i !== index)})}><KTIcon iconName='trash' className='fs-3' /></button></div>
        </div>
      </div>)}
      <div className='d-flex align-items-center flex-wrap gap-4 mb-6'>
        <button className='btn btn-light-primary' disabled={!canEdit || save.isPending || draft.preinformes.length >= 52} onClick={() => change({...draft,
          preinformes: [...draft.preinformes, {nombre: intl.formatMessage({id: 'preinformes.number'}, {number: draft.preinformes.length + 1}), peso: null, fecha_inicio: null, fecha_fin: null}]})}>
          <KTIcon iconName='plus' className='fs-3' />{t('preinformes.add')}</button>
        {draft.configuracion.modo === 'WEIGHTED_AVERAGE' && <span className={`badge badge-light-${Math.abs(total - 100) < 0.000001 ? 'success' : 'warning'} fs-6`}>{t('grading.total')}: {Number(total.toFixed(4))}% / 100%</span>}
      </div>
    </>}
    {save.error && <div className='alert alert-danger' role='alert'>{save.error.message}</div>}
    <div className='d-flex justify-content-end'><button className='btn btn-primary' disabled={!canEdit || !dirty || save.isPending}
      onClick={() => save.mutate(draft, {onSuccess: () => {setDirty(false); toast.success(t('grading.saved'))}})}>
      <KTIcon iconName='check' className='fs-3' />{save.isPending ? t('grading.saving') : t('grading.save')}</button></div>
  </div>
}
