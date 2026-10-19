import {useState} from 'react'
import {useIntl} from 'react-intl'
import {useAuthz} from '@/app/modules/auth/core/authz'
import type {BoletinData} from '../boletines.types'
import {bulletinPdfUrl, useBulletinIssues, useIssueActions, type IssueSelection} from '../emisiones.api'
import {useTemplateCatalog} from '../plantillas.api'

export function BulletinIssueCard({matriculaToken, periods}: {matriculaToken: string; periods: BoletinData['periodos']}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {hasPermission} = useAuthz()
  const canPrepare = hasPermission('boletines.emisiones.preparar')
  const canApprove = hasPermission('boletines.emisiones.aprobar')
  const canPublish = hasPermission('boletines.emisiones.publicar')
  const canReadTemplates = hasPermission('boletines.plantillas.ver') || hasPermission('boletines.plantillas.gestionar')
  const templates = useTemplateCatalog(1, canReadTemplates)
  const [page, setPage] = useState(1)
  const issues = useBulletinIssues(matriculaToken, page)
  const actions = useIssueActions(matriculaToken)
  const [context, setContext] = useState(periods[0]?.id ?? 'final')
  const [template, setTemplate] = useState('')
  const [preview, setPreview] = useState<import('../emisiones.api').IssuePreview | null>(null)
  const selection: IssueSelection = context === 'final' ? {contexto: 'final', plantilla_token: template || null}
    : {contexto: 'periodo', periodo_token: context, plantilla_token: template || null}
  const contextLabel = (item: {contexto: 'periodo' | 'final'; periodo_token: string | null}) => item.contexto === 'final'
    ? t('boletines.issue.final') : periods.find(period => period.id === item.periodo_token)?.nombre ?? t('boletines.issue.period')
  const currentTemplates = canReadTemplates ? templates.data?.plantillas.filter(item => item.ambito === selection.contexto
    && item.revision_publicada !== null) ?? [] : []
  const busy = actions.preview.isPending || actions.prepare.isPending || actions.approve.isPending || actions.publish.isPending
  const error = actions.preview.error ?? actions.prepare.error ?? actions.approve.error ?? actions.publish.error

  return <section className='card mt-5 d-print-none' aria-labelledby='bulletin-issue-title'>
    <div className='card-header'><h3 className='card-title' id='bulletin-issue-title'>{t('boletines.issue.title')}</h3></div>
    <div className='card-body'>
      <p className='text-muted'>{t('boletines.issue.help')}</p>
      {canPrepare && <div className='row g-3 align-items-end mb-5'>
        <div className='col-md-5'><label className='form-label' htmlFor='bulletin-issue-context'>{t('boletines.issue.context')}</label>
          <select className='form-select' id='bulletin-issue-context' value={context} onChange={event => {
            setContext(event.target.value); setTemplate(''); setPreview(null)
          }}>
            {periods.map(period => <option key={period.id} value={period.id}>{period.nombre}</option>)}
            <option value='final'>{t('boletines.issue.final')}</option>
          </select></div>
        <div className='col-md-5'><label className='form-label' htmlFor='bulletin-issue-template'>{t('boletines.issue.template')}</label>
          <select className='form-select' id='bulletin-issue-template' value={template} onChange={event => {
            setTemplate(event.target.value); setPreview(null)
          }}>
            <option value=''>{t('boletines.issue.baseTemplate')}</option>
            {currentTemplates.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
          </select></div>
        <div className='col-md-2'><button type='button' className='btn btn-light-primary w-100' disabled={busy}
          onClick={() => actions.preview.mutate(selection, {onSuccess: setPreview})}>{t('boletines.issue.check')}</button></div>
      </div>}
      {error && <div className='alert alert-danger' role='alert'>{error.message}</div>}
      {preview && <div className='alert alert-info d-flex justify-content-between align-items-center gap-3'>
        <span>{t('boletines.issue.ready')} · {preview.resumen.estudiante.nombre} · {preview.resumen.asignaturas} {t('boletines.issue.subjects')}</span>
        <button className='btn btn-sm btn-primary' type='button' disabled={busy}
          onClick={() => actions.prepare.mutate(selection, {onSuccess: () => setPreview(null)})}>{t('boletines.issue.prepare')}</button>
      </div>}
      {issues.isLoading && <p role='status'>{t('boletines.issue.loading')}</p>}
      {issues.isError && <div className='alert alert-danger' role='alert'>{issues.error.message}</div>}
      {issues.data?.data.length === 0 && <p className='text-muted'>{t('boletines.issue.empty')}</p>}
      {issues.data?.data.map(item => <div className='border rounded p-4 mb-3' key={item.token}>
        <div className='d-flex flex-wrap justify-content-between align-items-center gap-3'>
          <div><strong>{contextLabel(item)}</strong> · {t('boletines.issue.revision')} {item.revision}
            <span className={`badge ms-3 ${item.estado === 'publicado' ? 'badge-light-success'
              : item.estado === 'aprobado' ? 'badge-light-primary' : item.estado === 'preparado' ? 'badge-light-warning' : 'badge-light-secondary'}`}>
              {t(`boletines.issue.state.${item.estado}`)}
            </span>
            {item.plantilla && <div className='text-muted fs-8 mt-1'>{item.plantilla}</div>}
          </div>
          <div className='d-flex flex-wrap gap-2'>
            {canApprove && item.estado === 'preparado' && <button className='btn btn-sm btn-light-primary' disabled={busy}
              type='button' onClick={() => actions.approve.mutate(item.token)}>{t('boletines.issue.approve')}</button>}
            {canPublish && item.estado === 'aprobado' && <button className='btn btn-sm btn-primary' disabled={busy}
              type='button' onClick={() => {
                if (window.confirm(t('boletines.issue.publishConfirm'))) actions.publish.mutate(item.token)
              }}>{t('boletines.issue.publish')}</button>}
            {item.pdf_disponible && (canApprove || canPublish || item.estado === 'publicado') &&
              <a className='btn btn-sm btn-light' href={bulletinPdfUrl(item.token)} target='_blank' rel='noreferrer'>
                {t('boletines.issue.download')}</a>}
          </div>
        </div>
      </div>)}
      {issues.data && issues.data.ultima_pagina > 1 && <div className='d-flex align-items-center gap-3'>
        <button type='button' className='btn btn-sm btn-light' disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{t('boletines.issue.previous')}</button>
        <span className='text-muted fs-8'>{t('boletines.issue.page')} {page} / {issues.data.ultima_pagina}</span>
        <button type='button' className='btn btn-sm btn-light' disabled={page >= issues.data.ultima_pagina} onClick={() => setPage(value => value + 1)}>{t('boletines.issue.next')}</button>
      </div>}
    </div>
  </section>
}
