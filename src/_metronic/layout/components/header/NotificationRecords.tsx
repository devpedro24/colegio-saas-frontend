import {useQuery} from '@tanstack/react-query'
import {useEffect} from 'react'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import recordMessages from './notificationRecords.messages.json'

export type NotificationRecord = {
  token: string
  variant: 'success' | 'updated' | 'deleted' | 'danger'
  event: string
  subject: string
  message: string | null
  created_at: string
}

function useNotificationRecords(enabled: boolean, scope: string, page: number) {
  return useQuery({
    queryKey: ['notification-records', scope, page], enabled,
    queryFn: () => api.get<{data: NotificationRecord[]; meta: {current_page: number; last_page: number; total: number}}>(`/notification-records?page=${page}`),
  })
}

const appearance = {
  success: ['success', 'check-circle'], updated: ['primary', 'pencil'],
  deleted: ['danger', 'trash'], danger: ['danger', 'cross-circle'],
} as const

export default function NotificationRecords({scope, page, setPage, onTotal}: {
  scope: string; page: number; setPage: (page: number) => void; onTotal: (total: number) => void
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id: `header.notifications.${id}`})
  const recordCopy: Record<string, string> = recordMessages[intl.locale.startsWith('es') ? 'es' : 'en']
  const query = useNotificationRecords(true, scope, page)
  useEffect(() => {if (query.data) onTotal(query.data.meta.total)}, [query.data, onTotal])
  if (query.isPending) return <div className='text-center py-10' role='status'>{t('loading')}</div>
  if (query.isError) return <div className='text-center py-10'>
    <p role='alert'>{t('loadError')}</p><button type='button' className='btn btn-sm btn-light-primary' onClick={() => void query.refetch()}>{t('retry')}</button>
  </div>
  if (!query.data.data.length) return <div className='text-center py-10 text-muted'>{t('noRecords')}</div>
  return <div data-testid='notification-records'>
    {query.data.data.map(record => {
      const [color, icon] = appearance[record.variant] ?? appearance.success
      const label = recordCopy[`event.${record.event}`] ?? t('actionRecorded')
      return <div key={record.token} className='d-flex gap-3 py-4 border-bottom border-gray-200' data-notification-record={record.token}>
        <span className='symbol symbol-35px flex-shrink-0'><span className={`symbol-label bg-light-${color}`}>
          <i className={`ki-solid ki-${icon} fs-3 text-${color}`} aria-hidden='true' />
        </span></span>
        <div className='min-w-0 flex-grow-1'>
          <div className='fw-semibold text-gray-900'>{record.variant === 'danger' ? t('failed') : label}</div>
          {record.variant === 'danger' && <div className='text-muted fs-7'>{recordCopy[`scope.${record.event.split('.')[0]}`] ?? t('actionRecorded')}</div>}
          {record.subject && <div className='text-gray-700 fs-7 text-break'>{record.subject}</div>}
          {record.message && <div className='text-gray-700 fs-7 text-break'>{record.message}</div>}
          <time className='text-muted fs-8' dateTime={record.created_at}>
            {intl.formatDate(record.created_at, {day: 'numeric', month: 'short', year: 'numeric'})}
            {' · '}{intl.formatTime(record.created_at, {hour: 'numeric', minute: '2-digit'})}
          </time>
        </div>
      </div>
    })}
    {query.data.meta.last_page > 1 && <div className='d-flex justify-content-between align-items-center pt-4 gap-2'>
      <button type='button' className='btn btn-sm btn-light' disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)}>{t('previous')}</button>
      <span className='text-muted fs-8'>{page} / {query.data.meta.last_page}</span>
      <button type='button' className='btn btn-sm btn-light' disabled={page >= query.data.meta.last_page || query.isFetching} onClick={() => setPage(page + 1)}>{t('next')}</button>
    </div>}
  </div>
}
