import {useCallback, useEffect, useState, type FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {useWorkDraft} from '@/lib/drafts/WorkDrafts'
import {PageTitle} from '@/_metronic/layout/core'
import {Content} from '@/_metronic/layout/components/content'
import {AcademicYearPicker, AcademicYearProvider, useAcademicYear} from '../academic-year-context'
import {useToast} from '@/lib/ui/toast'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {AssignedIndicatorsPage} from './AssignedIndicatorsPage'
import {useAcademicSearchParams} from '../shared/useAcademicSearchParams'
import {useIndicatorActions, useIndicatorBases, useIndicatorBindings, useIndicatorDrafts, useIndicatorPolicy, useIndicatorSetup,
  type IndicatorBinding} from './indicadores.api'

function BindingCard({item, periods, writable}: {item: IndicatorBinding;
  periods: Array<{orden: number; nombre: string}>; writable: boolean}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const {editGradeText} = useIndicatorActions()
  const [text, setText] = useState(item.texto_vinculado)
  const recovery = useWorkDraft({context: `indicator-binding:${item.vinculo_token}`, title: t('indicators.title'),
    value: text, dirty: text !== item.texto_vinculado, base: String(item.version_vinculo), enabled: writable,
    restore: setText, reset: () => setText(item.texto_vinculado)})
  const save = () => {const finishDraft = recovery.afterSave(); editGradeText.mutate({binding: item.vinculo_token,
    input: {version: item.version_vinculo, texto: text.trim()}},
  {onSuccess: () => {finishDraft(); toast.success(t('indicators.saved'))}, onError: error => toast.error(error.message)})}
  const scope = item.periodos_orden?.length
    ? periods.filter(period => item.periodos_orden?.includes(period.orden)).map(period => period.nombre).join(', ')
    : t('indicators.allPeriods')
  return <div className='border rounded-3 p-4 mb-3'>
    {recovery.notice}
    <div className='d-flex flex-wrap justify-content-between gap-2'><p className='fw-semibold mb-2'>{item.texto_vinculado}</p>
      <span className='badge badge-light-primary align-self-start'>{scope}</span></div>
    <details><summary className='text-primary cursor-pointer'>{t('indicators.editBase')}</summary>
      <textarea className='form-control mb-3' rows={2} maxLength={2000} value={text} disabled={!writable}
        onChange={event => setText(event.target.value)} />
      <div className='d-flex flex-wrap justify-content-end gap-3'>
        <button className='btn btn-sm btn-primary' type='button' disabled={!writable || !text.trim() || editGradeText.isPending}
          onClick={save}>{t('indicators.saveGroup')}</button>
      </div>
    </details>
  </div>
}

function ManagementBody() {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const {yearToken, writable} = useAcademicYear()
  const [params, setParams] = useAcademicSearchParams('indicadores')
  const grade = params.get('grado') ?? ''
  const subject = params.get('materia') ?? ''
  const period = params.get('periodo') ?? ''
  const select = useCallback((field: string, value: string, clear: string[] = []) => setParams(current => {
    const next = new URLSearchParams(current)
    if (value) next.set(field, value); else next.delete(field)
    clear.forEach(key => next.delete(key))
    return next
  }, {replace: true}), [setParams])
  const setGrade = (value: string) => select('grado', value, ['materia'])
  const setSubject = (value: string) => select('materia', value)
  const setPeriod = (value: string) => select('periodo', value)
  const [search, setSearch] = useState('')
  const [base, setBase] = useState('')
  const [text, setText] = useState('')
  const [order, setOrder] = useState(1)
  const [page, setPage] = useState(1)
  const setup = useIndicatorSetup(yearToken, grade)
  const selectedPeriod = setup.data?.periodos.find(item => item.token === period)
    ?? setup.data?.periodos.find(item => item.estado === 'abierto') ?? setup.data?.periodos[0]
  const bindings = useIndicatorBindings(yearToken, grade, subject, selectedPeriod?.token ?? '', page)
  const drafts = useIndicatorDrafts(yearToken, grade, subject, selectedPeriod?.token ?? '')
  const bases = useIndicatorBases(!!yearToken, search)
  const {create, bind} = useIndicatorActions()
  useEffect(() => setPage(1), [yearToken])
  useEffect(() => {
    if (!setup.data) return
    if (grade && !setup.data.grados.some(item => item.token === grade)) select('grado', '', ['materia'])
    else if (subject && !setup.data.materias.some(item => item.token === subject)) select('materia', '')
  }, [grade, subject, setup.data, select])
  const selectedClosed = selectedPeriod?.estado !== 'abierto'
  const input = {ano_token: yearToken, grado_token: grade, materia_token: subject,
    periodos_orden: selectedPeriod ? [selectedPeriod.orden] : null}
  const formContext = `indicator-grade:${yearToken}:${grade}:${subject}:${selectedPeriod?.token ?? ''}`
  const [editingContext, setEditingContext] = useState(formContext)
  useEffect(() => {setEditingContext(formContext); setText(''); setOrder(1); setBase('')}, [formContext])
  const recovery = useWorkDraft({context: formContext, title: t('indicators.title'), value: {text, order},
    dirty: !!text.trim() && editingContext === formContext, enabled: writable && !selectedClosed && !!grade && !!subject,
    restore: value => {setText(value.text); setOrder(value.order)}, reset: () => {setText(''); setOrder(1)}})
  const createNew = (event: FormEvent) => {
    event.preventDefault()
    const finishDraft = recovery.afterSave()
    create.mutate({...input, texto: text.trim(), orden: order}, {
      onSuccess: () => {finishDraft(); setText(''); toast.success(t('indicators.saved'))},
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
          <div className='col-md-4'><label htmlFor='indicator-grade' className='form-label'>{t('indicators.grade')}</label>
            <select id='indicator-grade' className='form-select' value={grade} onChange={event => {setGrade(event.target.value); setPage(1)}}>
              <option value=''>{t('indicators.selectGrade')}</option>
              {setup.data?.grados.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
            </select></div>
          <div className='col-md-4'><label htmlFor='indicator-subject' className='form-label'>{t('indicators.subject')}</label>
            <select id='indicator-subject' className='form-select' value={subject} disabled={!grade} onChange={event => {setSubject(event.target.value); setPage(1)}}>
              <option value=''>{t('indicators.selectSubject')}</option>
              {setup.data?.materias.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
            </select></div>
          <div className='col-md-4'><label htmlFor='indicator-period' className='form-label'>{t('evaluacion.period')}</label>
            <select id='indicator-period' className='form-select' value={selectedPeriod?.token ?? ''}
              onChange={event => {setPeriod(event.target.value); setPage(1)}}>
              {setup.data?.periodos.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
            </select></div>
        </div>
        {grade && !setup.data?.materias.length && !setup.isLoading && <div className='alert alert-info'>{t('indicators.noCurriculum')}</div>}
        {!!subject && <>
          <div className='border rounded-3 p-5 mb-5'>
            {recovery.notice}
            <h4>{t('indicators.add')}</h4>
            <p className='text-muted fs-7'>{t('indicators.reuseHelp')}</p>
            <fieldset disabled={!writable} className='border-0 p-0 m-0'>
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
              {!!drafts.data?.length && <div className='mb-5'>
                <label className='form-label' htmlFor='indicator-draft'>{t('indicators.drafts')}</label>
                <select id='indicator-draft' className='form-select' defaultValue=''
                  onChange={event => setText(event.target.value)}>
                  <option value=''>{t('indicators.selectDraft')}</option>
                  {drafts.data.map(item => <option key={item.texto} value={item.texto}>{item.texto}</option>)}
                </select>
                <p className='text-muted fs-8 mt-2'>{t('indicators.draftsHelp')}</p>
              </div>}
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
            {bindings.data.data.map(item => <BindingCard key={`${item.vinculo_token}:${item.version_vinculo}`} item={item}
              periods={setup.data?.periodos ?? []} writable={writable && !selectedClosed} />)}
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

function ManagerScopeBody() {
  const {yearToken} = useAcademicYear()
  const policy = useIndicatorPolicy(yearToken)
  if (policy.isLoading) return <div className='card card-body' role='status'>Cargando indicadores…</div>
  if (policy.isError) return <div className='alert alert-danger' role='alert'>{policy.error.message}</div>
  if (policy.data?.alcance !== 'grado') return <AssignedIndicatorsPage fixedYearToken={yearToken} />
  return <ManagementBody />
}

export default function IndicadoresPage() {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const {hasPermission} = useAuthz()
  if (!hasPermission('indicadores.base.gestionar')) return <><PageTitle>{t('indicators.title')}</PageTitle><Content>
    <AssignedIndicatorsPage />
  </Content></>
  return <><PageTitle>{t('indicators.title')}</PageTitle><Content>
    <AcademicYearProvider filterScope='indicadores' source={hasPermission('academico.anos.gestionar') ? 'management' : 'evaluation'}>
      <div className='card mb-6'><div className='card-body d-flex flex-wrap justify-content-between align-items-center gap-3'>
        <div><h2 className='mb-1'>{t('indicators.title')}</h2><p className='text-muted mb-0'>{t('indicators.managementHelp')}</p></div>
        <AcademicYearPicker />
      </div></div>
      <ManagerScopeBody />
    </AcademicYearProvider>
  </Content></>
}
