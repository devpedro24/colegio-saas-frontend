import {useEffect, useState, type FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {PageTitle} from '@/_metronic/layout/core'
import {Content} from '@/_metronic/layout/components/content'
import {AcademicYearPicker, AcademicYearProvider, useAcademicYear} from '../academic-year-context'
import {useToast} from '@/lib/ui/toast'
import {useIndicatorActions, useIndicatorBases, useIndicatorBindings, useIndicatorSetup,
  type IndicatorBinding} from './indicadores.api'

function BindingCard({item, periods, writable}: {item: IndicatorBinding;
  periods: Array<{orden: number; nombre: string}>; writable: boolean}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const {revise, updateBinding} = useIndicatorActions()
  const [text, setText] = useState(item.texto_base)
  useEffect(() => setText(item.texto_base), [item.texto_base])
  const saveBase = () => revise.mutate({indicator: item.indicador_token,
    input: {version: item.version_base, texto: text.trim(), orden: item.orden}},
  {onSuccess: () => toast.success(t('indicators.saved')), onError: error => toast.error(error.message)})
  const applyRevision = () => updateBinding.mutate({binding: item.vinculo_token, input: {
    version: item.version_vinculo, periodos_orden: item.periodos_orden, usar_revision_actual: true,
  }}, {onSuccess: () => toast.success(t('indicators.saved')), onError: error => toast.error(error.message)})
  const scope = item.periodos_orden?.length
    ? periods.filter(period => item.periodos_orden?.includes(period.orden)).map(period => period.nombre).join(', ')
    : t('indicators.allPeriods')
  return <div className='border rounded-3 p-4 mb-3'>
    <div className='d-flex flex-wrap justify-content-between gap-2'><p className='fw-semibold mb-2'>{item.texto_vinculado}</p>
      <span className='badge badge-light-primary align-self-start'>{scope}</span></div>
    <p className='text-muted fs-8'>{t('indicators.pinnedRevision')}: {item.revision_vinculada}
      {item.version_base > item.revision_vinculada && ` · ${t('indicators.newerRevision')}`}</p>
    <details><summary className='text-primary cursor-pointer'>{t('indicators.editBase')}</summary>
      <p className='text-muted fs-7 mt-3'>{t('indicators.revisionHelp')}</p>
      <textarea className='form-control mb-3' rows={2} maxLength={2000} value={text} disabled={!writable}
        onChange={event => setText(event.target.value)} />
      <div className='d-flex flex-wrap justify-content-end gap-3'>
        {item.version_base > item.revision_vinculada && <button className='btn btn-sm btn-light-primary' type='button'
          disabled={!writable || updateBinding.isPending} onClick={applyRevision}>{t('indicators.applyRevision')}</button>}
        <button className='btn btn-sm btn-primary' type='button' disabled={!writable || !text.trim() || revise.isPending}
          onClick={saveBase}>{t('indicators.saveNewRevision')}</button>
      </div>
    </details>
  </div>
}

function ManagementBody() {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const {yearToken, writable} = useAcademicYear()
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [search, setSearch] = useState('')
  const [base, setBase] = useState('')
  const [text, setText] = useState('')
  const [order, setOrder] = useState(1)
  const [periodOrders, setPeriodOrders] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const setup = useIndicatorSetup(yearToken, grade)
  const bindings = useIndicatorBindings(yearToken, grade, subject, page)
  const bases = useIndicatorBases(!!yearToken, search)
  const {create, bind} = useIndicatorActions()
  useEffect(() => {setGrade(''); setSubject(''); setPeriodOrders([]); setPage(1)}, [yearToken])
  useEffect(() => {if (grade && setup.data && !setup.data.grados.some(item => item.token === grade)) setGrade('')}, [grade, setup.data])
  useEffect(() => {if (subject && setup.data && !setup.data.materias.some(item => item.token === subject)) setSubject('')}, [subject, setup.data])
  const selectedClosed = !periodOrders.length
    ? setup.data?.periodos.some(period => period.estado === 'cerrado')
    : setup.data?.periodos.some(period => periodOrders.includes(period.orden) && period.estado === 'cerrado')
  const input = {ano_token: yearToken, grado_token: grade, materia_token: subject,
    periodos_orden: periodOrders.length ? periodOrders : null}
  const createNew = (event: FormEvent) => {
    event.preventDefault()
    create.mutate({...input, texto: text.trim(), orden: order}, {
      onSuccess: () => {setText(''); toast.success(t('indicators.saved'))},
      onError: error => toast.error(error.message),
    })
  }
  const bindExisting = () => bind.mutate({indicator: base, input}, {
    onSuccess: () => {setBase(''); toast.success(t('indicators.saved'))},
    onError: error => toast.error(error.message),
  })
  return <>
    <div className='card mb-6'><div className='card-header'><h3 className='card-title'>{t('indicators.catalog')}</h3></div>
      <div className='card-body'>
        <p className='text-muted'>{t('indicators.catalogHelp')}</p>
        {setup.isError && <div className='alert alert-danger' role='alert'>{setup.error.message}</div>}
        <div className='row g-4 mb-5'>
          <div className='col-md-6'><label htmlFor='indicator-grade' className='form-label'>{t('indicators.grade')}</label>
            <select id='indicator-grade' className='form-select' value={grade} onChange={event => {setGrade(event.target.value); setSubject(''); setPage(1)}}>
              <option value=''>{t('indicators.selectGrade')}</option>
              {setup.data?.grados.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
            </select></div>
          <div className='col-md-6'><label htmlFor='indicator-subject' className='form-label'>{t('indicators.subject')}</label>
            <select id='indicator-subject' className='form-select' value={subject} disabled={!grade} onChange={event => {setSubject(event.target.value); setPage(1)}}>
              <option value=''>{t('indicators.selectSubject')}</option>
              {setup.data?.materias.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
            </select></div>
        </div>
        {grade && !setup.data?.materias.length && !setup.isLoading && <div className='alert alert-info'>{t('indicators.noCurriculum')}</div>}
        {!!subject && <>
          <div className='border rounded-3 p-5 mb-5'>
            <h4>{t('indicators.add')}</h4>
            <p className='text-muted fs-7'>{t('indicators.reuseHelp')}</p>
            <fieldset disabled={!writable} className='border-0 p-0 m-0'>
              <p className='fw-semibold mb-2'>{t('indicators.scope')}</p>
              <p className='text-muted fs-8'>{t('indicators.scopeHelp')}</p>
              <div className='d-flex flex-wrap gap-4 mb-5'>
                {setup.data?.periodos.map(period => <label key={period.token} className='form-check form-check-custom form-check-solid'>
                  <input className='form-check-input' type='checkbox' checked={periodOrders.includes(period.orden)} disabled={period.estado === 'cerrado'}
                    onChange={event => setPeriodOrders(current => event.target.checked
                      ? [...current, period.orden] : current.filter(order => order !== period.orden))} />
                  <span className='form-check-label'>{period.nombre}</span></label>)}
              </div>
              {selectedClosed && <div className='alert alert-warning'>{t('indicators.closedScope')}</div>}
              <form onSubmit={createNew} className='mb-6'>
                <label className='form-label' htmlFor='institutional-indicator-text'>{t('indicators.newText')}</label>
                <textarea id='institutional-indicator-text' className='form-control mb-3' rows={3} maxLength={2000} value={text}
                  onChange={event => setText(event.target.value)} />
                <div className='d-flex flex-wrap justify-content-between gap-3'>
                  <div><label className='form-label me-2' htmlFor='indicator-order'>{t('indicators.order')}</label>
                    <input id='indicator-order' className='form-control d-inline-block w-90px' type='number' min={1} max={1000} value={order}
                      onChange={event => setOrder(Number(event.target.value))} /></div>
                  <button className='btn btn-primary' disabled={!text.trim() || !!selectedClosed || create.isPending}>{t('indicators.create')}</button>
                </div>
              </form>
              <label className='form-label' htmlFor='indicator-search'>{t('indicators.existing')}</label>
              <input id='indicator-search' className='form-control mb-3' value={search} maxLength={120}
                placeholder={t('indicators.search')} onChange={event => {setSearch(event.target.value); setBase('')}} />
              <div className='d-flex flex-wrap gap-3'><select className='form-select flex-grow-1' style={{minWidth: 220}} value={base}
                aria-label={t('indicators.existing')} onChange={event => setBase(event.target.value)}>
                <option value=''>{t('indicators.selectExisting')}</option>
                {bases.data?.data.map(item => <option key={item.indicador_token} value={item.indicador_token}>{item.texto}</option>)}
              </select><button className='btn btn-light-primary' type='button' disabled={!base || !!selectedClosed || bind.isPending}
                onClick={bindExisting}>{t('indicators.bind')}</button></div>
            </fieldset>
          </div>
          <h4>{t('indicators.linked')}</h4>
          {bindings.isLoading && <p role='status'>{t('common.pleaseWait')}</p>}
          {bindings.isError && <div className='alert alert-danger' role='alert'>{bindings.error.message}</div>}
          {bindings.data && <>
            {!bindings.data.data.length && <div className='alert alert-info'>{t('indicators.empty')}</div>}
            {bindings.data.data.map(item => <BindingCard key={item.vinculo_token} item={item}
              periods={setup.data?.periodos ?? []} writable={writable} />)}
            {bindings.data.meta.ultima_pagina > 1 && <nav className='d-flex justify-content-end gap-3 align-items-center'
              aria-label={t('indicators.pages')}>
              <button className='btn btn-sm btn-light' disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('indicators.previous')}</button>
              <span>{page} / {bindings.data.meta.ultima_pagina}</span>
              <button className='btn btn-sm btn-light' disabled={page >= bindings.data.meta.ultima_pagina}
                onClick={() => setPage(page + 1)}>{t('indicators.next')}</button></nav>}
          </>}
        </>}
      </div>
    </div>
  </>
}

export default function IndicadoresPage() {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  return <><PageTitle>{t('indicators.title')}</PageTitle><Content>
    <AcademicYearProvider>
      <div className='card mb-6'><div className='card-body d-flex flex-wrap justify-content-between align-items-center gap-3'>
        <div><h2 className='mb-1'>{t('indicators.title')}</h2><p className='text-muted mb-0'>{t('indicators.managementHelp')}</p></div>
        <AcademicYearPicker />
      </div></div>
      <ManagementBody />
    </AcademicYearProvider>
  </Content></>
}
