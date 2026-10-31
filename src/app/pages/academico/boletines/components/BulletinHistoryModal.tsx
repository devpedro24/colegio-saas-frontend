import {useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {bulletinPdfUrl, useBulletinIssues} from '../emisiones.api'

export function BulletinHistoryModal({enrollment, periods, onClose}: {
  enrollment: {token: string; name: string}; periods: {id: string; nombre: string}[]; onClose: () => void
}) {
  const intl = useIntl(), t = (id: string) => intl.formatMessage({id})
  const [page, setPage] = useState(1)
  const query = useBulletinIssues(enrollment.token, page)
  return <Modal show onHide={onClose} centered scrollable size='lg' backdrop='static' aria-labelledby='bulletin-history-title'>
    <Modal.Header><div><Modal.Title id='bulletin-history-title'>{t('boletines.archive.title')}</Modal.Title><p className='mb-0 mt-1 text-muted'>{enrollment.name}</p></div>
      <button type='button' className='bulletin-modal-close' onClick={onClose} aria-label={t('common.close')}><i className='ki-outline ki-cross' aria-hidden='true' /></button></Modal.Header>
    <Modal.Body>
      <p className='text-muted fs-7'>{t('boletines.archive.help')}</p>
      {query.isPending && <p role='status'>{t('common.pleaseWait')}</p>}
      {query.isError && <div className='alert alert-danger' role='alert'>{query.error.message}</div>}
      {query.data?.total === 0 && <p>{t('boletines.issue.empty')}</p>}
      <div className='bulletin-archive-list'>{query.data?.data.map(item => <article className='bulletin-archive-entry' key={item.token}>
        <span className='bulletin-archive-icon'><i className='bi bi-file-earmark-pdf' aria-hidden='true' /></span>
        <div className='flex-grow-1 min-w-0'><strong>{item.contexto === 'final' ? t('boletines.issue.final') : periods.find(period => period.id === item.periodo_token)?.nombre ?? t('boletines.issue.period')} · {t('boletines.issue.revision')} {item.revision}</strong>
          <div className='fs-7 text-muted'>{item.plantilla}</div><div className='bulletin-archive-filename'>{item.archivo}</div>
          <small className='text-muted'>{item.aprobado_en && intl.formatDate(item.aprobado_en, {dateStyle: 'medium', timeStyle: 'short'})} · {t(`boletines.issue.state.${item.estado}`)}</small></div>
        {item.pdf_disponible && <a className='btn btn-sm bulletin-blue-button' href={bulletinPdfUrl(item.token)} target='_blank' rel='noreferrer'><i className='bi bi-download' aria-hidden='true' />{t('boletines.issue.download')}</a>}
      </article>)}</div>
    </Modal.Body>
    <Modal.Footer className='justify-content-between'>
      <div className='d-flex align-items-center gap-3'>
        <button type='button' className='btn btn-sm btn-light' disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>{t('boletines.issue.previous')}</button>
        <span>{page} / {query.data?.ultima_pagina ?? 1}</span><button type='button' className='btn btn-sm btn-light' disabled={page >= (query.data?.ultima_pagina ?? 1) || query.isFetching} onClick={() => setPage(value => value + 1)}>{t('boletines.issue.next')}</button>
      </div><button type='button' className='btn btn-light' onClick={onClose}>{t('common.close')}</button>
    </Modal.Footer>
  </Modal>
}
