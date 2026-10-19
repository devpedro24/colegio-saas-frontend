import {useEffect, useState, type FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useBulletinPolicy} from '../../boletines/observaciones.api'
import {
  useIndicatorActions, useIndicatorBases, useIndicatorCatalog,
  type IndicatorContext, type IndicatorItem,
} from '../indicadores.api'

function IndicatorRow({item, context, canVariant, periodState}: {
  item: IndicatorItem; context: IndicatorContext; canVariant: boolean; periodState: string
}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const {variant} = useIndicatorActions()
  const [variantText, setVariantText] = useState(item.texto)
  useEffect(() => setVariantText(item.texto), [item.texto])
  const writable = periodState === 'abierto'
  const saveVariant = () => variant.mutate({binding: item.vinculo_token, input: {
    grupo_token: context.group, periodo_orden: context.periodOrder,
    texto: variantText.trim(), version: item.version_variante,
  }}, {onSuccess: () => toast.success(t('indicators.saved')), onError: error => toast.error(error.message)})
  return <div className='border rounded-3 p-4 mb-3'>
    <div className='d-flex flex-wrap justify-content-between gap-3 mb-2'><p className='fw-semibold mb-0'>{item.texto}</p>
      <span className={`badge badge-light-${item.fuente === 'grupo' ? 'info' : 'primary'}`}>
        {t(item.fuente === 'grupo' ? 'indicators.groupVariant' : 'indicators.institutional')}</span></div>
    {canVariant && <details><summary className='text-primary cursor-pointer'>{t('indicators.editGroup')}</summary>
      <p className='text-muted fs-8 mt-3'>{t('indicators.groupHelp')}</p>
      <textarea className='form-control mb-3' rows={2} maxLength={2000} value={variantText} disabled={!writable}
        onChange={event => setVariantText(event.target.value)} />
      <div className='d-flex justify-content-end'><button type='button' className='btn btn-sm btn-light-primary'
        disabled={!writable || !variantText.trim() || variant.isPending} onClick={saveVariant}>{t('indicators.saveVariant')}</button></div>
    </details>}
  </div>
}

export function IndicadorWorkspace({context, periodState}: {
  context: IndicatorContext; periodState: string
}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const {hasPermission} = useAuthz()
  const canManage = hasPermission('indicadores.base.gestionar')
  const mayVariant = hasPermission('indicadores.grupo.editar')
  const bulletinPolicy = useBulletinPolicy(mayVariant && !canManage)
  const canVariant = mayVariant && (canManage || !!bulletinPolicy.data?.docente_edita_indicadores_grupo)
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [onlyCurrent, setOnlyCurrent] = useState(false)
  const [selectedBase, setSelectedBase] = useState('')
  const query = useIndicatorCatalog(context, page)
  const bases = useIndicatorBases(canManage)
  const {create, bind} = useIndicatorActions()
  const createInput = {ano_token: context.year, grado_token: context.grade, materia_token: context.subject,
    periodos_orden: onlyCurrent ? [context.periodOrder] : null}
  const createNew = (event: FormEvent) => {
    event.preventDefault()
    create.mutate({...createInput, texto: text.trim(), orden: 1}, {
      onSuccess: () => {setText(''); toast.success(t('indicators.saved'))},
      onError: error => toast.error(error.message),
    })
  }
  const bindExisting = () => {
    if (!selectedBase) return
    bind.mutate({indicator: selectedBase, input: createInput}, {
      onSuccess: () => {setSelectedBase(''); toast.success(t('indicators.saved'))},
      onError: error => toast.error(error.message),
    })
  }
  return <div className='card mt-7'>
    <div className='card-header'><div className='card-title flex-column align-items-start'>
      <h3 className='fw-bold mb-1'>{t('indicators.title')}</h3>
      <span className='text-muted fs-7'>{t('indicators.help')}</span>
    </div></div>
    <div className='card-body'>
      {canManage && query.data && <>
        <div className='border rounded-3 p-5 mb-5'>
          <h4 className='fw-bold'>{t('indicators.add')}</h4>
          <p className='text-muted fs-7'>{t('indicators.reuseHelp')}</p>
          <label className='form-check form-check-custom form-check-solid mb-4'>
            <input className='form-check-input' type='checkbox' checked={onlyCurrent} onChange={event => setOnlyCurrent(event.target.checked)} />
            <span className='form-check-label'>{t('indicators.onlyCurrent')}</span></label>
          <form onSubmit={createNew} className='d-flex flex-column gap-3 mb-5'>
            <label className='form-label mb-0' htmlFor='new-indicator'>{t('indicators.newText')}</label>
            <textarea id='new-indicator' className='form-control' rows={2} maxLength={2000} value={text}
              onChange={event => setText(event.target.value)} />
            <div className='d-flex justify-content-end'><button className='btn btn-primary' type='submit' disabled={!text.trim() || create.isPending || periodState === 'cerrado'}>{t('indicators.create')}</button></div>
          </form>
          <label className='form-label' htmlFor='existing-indicator'>{t('indicators.existing')}</label>
          <div className='d-flex flex-wrap gap-3'><select id='existing-indicator' className='form-select flex-grow-1' style={{minWidth: 220}} value={selectedBase}
            onChange={event => setSelectedBase(event.target.value)}><option value=''>{t('indicators.selectExisting')}</option>
            {bases.data?.data.map(base => <option key={base.indicador_token} value={base.indicador_token}>{base.texto}</option>)}</select>
            <button className='btn btn-light-primary' type='button' disabled={!selectedBase || bind.isPending || periodState === 'cerrado'} onClick={bindExisting}>{t('indicators.bind')}</button></div>
          {bases.data && bases.data.meta.total > bases.data.data.length && <p className='text-muted fs-8 mt-2'>{t('indicators.firstBases')}</p>}
        </div>
      </>}
      <div className='d-flex flex-wrap justify-content-between gap-3 align-items-end mb-5'>
        <div><h4 className='fw-bold mb-1'>{t('indicators.periodList')}</h4><p className='text-muted fs-7 mb-0'>{t('indicators.noGradeEffect')}</p></div>
      </div>
      {query.isLoading && <p role='status'>{t('common.pleaseWait')}</p>}
      {query.isError && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
      {query.data && <>
        {!query.data.indicadores.length && <div className='alert alert-info'>{t('indicators.empty')}</div>}
        {query.data.indicadores.map(item => <IndicatorRow key={item.vinculo_token} item={item} context={context}
          canVariant={canVariant} periodState={periodState} />)}
        {query.data.ultima_pagina > 1 && <nav className='d-flex justify-content-end gap-3 align-items-center' aria-label={t('indicators.pages')}>
          <button className='btn btn-sm btn-light' disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('indicators.previous')}</button>
          <span>{page} / {query.data.ultima_pagina}</span>
          <button className='btn btn-sm btn-light' disabled={page >= query.data.ultima_pagina} onClick={() => setPage(page + 1)}>{t('indicators.next')}</button>
        </nav>}
      </>}
    </div>
  </div>
}
