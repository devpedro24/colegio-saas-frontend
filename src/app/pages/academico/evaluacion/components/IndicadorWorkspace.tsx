import {useState} from 'react'
import {useIntl} from 'react-intl'
import {useIndicatorCatalog, useIndicatorPolicy, type IndicatorContext} from '../indicadores.api'
import {GroupIndicatorSheet} from './GroupIndicatorSheet'
import {safeIndicatorHtml} from './indicatorHtml'

/** The gradebook shares the indicators screen's data, HTML renderer and permissions. */
export function IndicadorWorkspace({context, periodState}: {context: IndicatorContext; periodState: string}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const policy = useIndicatorPolicy(context.year)
  if (policy.isPending) return <div className='card card-body mt-7' role='status'>{t('common.pleaseWait')}</div>
  if (policy.isError) return <div className='alert alert-danger mt-7' role='alert'>{policy.error.message}</div>
  return <section className='mt-7' aria-label={t('indicators.title')}>
    {periodState !== 'abierto' && <div className='alert alert-warning' role='status'>{t('indicators.sheet.closed')}</div>}
    {policy.data.alcance !== 'grado'
      ? <GroupIndicatorSheet group={context.group} period={context.period} subject={context.subject} title={t('indicators.title')} />
      : <GradeIndicators context={context} />}
  </section>
}

/** Grade-scoped indicators remain shared across groups; never create a group override here. */
function GradeIndicators({context}: {context: IndicatorContext}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const [page, setPage] = useState(1)
  const query = useIndicatorCatalog(context, page)
  return <div className='card'>
    <div className='card-header'><h3 className='card-title'>{t('indicators.title')}</h3></div>
    <div className='card-body'>
      {query.isLoading && <p role='status'>{t('common.pleaseWait')}</p>}
      {query.isError && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
      {query.data && <>
        {!query.data.indicadores.length && <p className='text-muted mb-0'>{t('indicators.sheet.empty')}</p>}
        {query.data.indicadores.map(item => <div key={item.vinculo_token} className='group-indicator-rich mb-3'
          dangerouslySetInnerHTML={{__html: safeIndicatorHtml(item.texto)}} />)}
        {query.data.ultima_pagina > 1 && <nav className='d-flex justify-content-end gap-3 align-items-center' aria-label={t('indicators.pages')}>
          <button className='btn btn-sm btn-light' disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('indicators.previous')}</button>
          <span>{page} / {query.data.ultima_pagina}</span>
          <button className='btn btn-sm btn-light' disabled={page >= query.data.ultima_pagina}
            onClick={() => setPage(page + 1)}>{t('indicators.next')}</button>
        </nav>}
      </>}
    </div>
  </div>
}
