import {useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'

type Notice = {selector: string; destinatario: string; tipo: string; fecha: string; intento: number; puede_reenviar: boolean}
type Decision = 'confirmar' | 'reenviar'
type Entry = {tipo_aviso?: string | null; destinatario: string; responsable: string; decision: Decision; motivo: string; fecha: string; intento: number}
type Review = {pendientes: Notice[]; paginas: number; historial: Entry[]; paginas_historial: number}

export function MailReviewPanel({path, onChange}: {path: string; onChange: () => void}) {
  const intl = useIntl()
  const toast = useToast()
  const client = useQueryClient()
  const t = (key: string) => intl.formatMessage({id: 'mailReview.' + key})
  const date = (value: string) => intl.formatDate(value, {dateStyle: 'medium', timeStyle: 'short'})
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')
  const list = useQuery({queryKey: ['mail-review', path, page, historyPage], enabled: open,
    queryFn: () => api.get<Review>(path + '?page=' + page + '&historial=' + historyPage)})
  const notice = list.data?.pendientes.find(item => item.selector + ':' + item.intento === selected)
  const action = useMutation({
    mutationFn: ({item, decision}: {item: Notice; decision: Decision}) =>
      api.post(path + '/' + encodeURIComponent(item.selector), {decision, motivo: reason.trim(), intento: item.intento}),
    onSuccess: (_, {decision}) => {
      setSelected('')
      setReason('')
      setPage(1)
      setHistoryPage(1)
      toast.success(t(decision === 'confirmar' ? 'confirmed' : 'authorized'))
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      void client.invalidateQueries({queryKey: ['mail-review', path]})
      onChange()
    },
  })
  const pagination = (current: number, last: number, change: (page: number) => void) => (last > 1 || current > 1) && (
    <div className='d-flex align-items-center gap-3 my-2'>
      <button type='button' className='btn btn-sm btn-light' disabled={current <= 1} onClick={() => change(current - 1)}>{t('previous')}</button>
      <small>{current} / {last}</small>
      <button type='button' className='btn btn-sm btn-light' disabled={current >= last} onClick={() => change(current + 1)}>{t('next')}</button>
    </div>)
  return <section className='my-4'>
    <button type='button' className='btn btn-sm btn-light-primary' aria-expanded={open} onClick={() => setOpen(!open)}>{t('title')}</button>
    {open && <div className='border rounded p-4 mt-3'>
      {list.isLoading && <p role='status'>{t('loading')}</p>}
      {list.isError && <p role='alert'>{t('error')} <button type='button' className='btn btn-link' onClick={() => void list.refetch()}>{t('retry')}</button></p>}
      {list.data && <>
        <h5>{t('pending')}</h5>
        {!list.data.pendientes.length && <p>{t('empty')}</p>}
        {list.data.pendientes.map(item => <button type='button' key={item.selector} disabled={action.isPending}
          aria-pressed={selected === item.selector + ':' + item.intento} className='btn btn-light btn-sm me-2 mb-2 text-start'
          onClick={() => {setSelected(item.selector + ':' + item.intento); setReason('')}}>
          <strong>{item.destinatario}</strong> · {t(item.tipo)} · {date(item.fecha)}
        </button>)}
        {pagination(page, list.data.paginas, setPage)}
        {notice && <div className='mb-4'>
          <label className='form-label w-100'>{t('reason')}
            <textarea className='form-control mt-1' rows={2} maxLength={1000} required disabled={action.isPending}
              value={reason} onChange={event => setReason(event.target.value)}/>
          </label>
          <p className='small'>{t(notice.puede_reenviar ? 'help' : 'used')}</p>
          <div className='d-flex flex-wrap gap-2'>
            <button type='button' className='btn btn-sm btn-success' disabled={!reason.trim() || action.isPending}
              onClick={() => action.mutate({item: notice, decision: 'confirmar'})}>{t('confirmar')}</button>
            {notice.puede_reenviar && <button type='button' className='btn btn-sm btn-light-warning' disabled={!reason.trim() || action.isPending}
              onClick={() => action.mutate({item: notice, decision: 'reenviar'})}>{t('reenviar')}</button>}
          </div>
        </div>}
        <h5 className='mt-4'>{t('history')}</h5>
        {!list.data.historial.length && <p className='mb-0'>{t('noHistory')}</p>}
        {list.data.historial.map((entry, index) => <div key={index} className='border-top py-2 text-break'>
          <strong>{t(entry.decision === 'confirmar' ? 'confirmed' : 'authorized')} · {entry.destinatario}{entry.tipo_aviso && ' · ' + t(entry.tipo_aviso)}</strong>
          <div>{entry.motivo}</div><small>{entry.responsable} · {date(entry.fecha)} · {entry.intento ? t('attempt') + ' ' + entry.intento : t('priorAttempt')}</small>
        </div>)}
        {pagination(historyPage, list.data.paginas_historial, setHistoryPage)}
      </>}
    </div>}
  </section>
}
