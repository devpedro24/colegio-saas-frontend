import {useEffect, useState, type FormEvent} from 'react'
import {Link, useNavigate, useParams} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {PageTitle} from '../../../_metronic/layout/core'
import {Content} from '../../../_metronic/layout/components/content'
import {api, ApiError} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import './SupportPage.css'

const states = ['abierto', 'en_proceso', 'esperando_colegio', 'resuelto', 'cerrado'] as const
const categories = ['tecnico', 'acceso', 'academico', 'suscripcion', 'otro'] as const
type State = typeof states[number]
type Ticket = {token: string; reference: string; school: string; origin: string; requester: string; subject: string;
  category: string; status: State; priority: boolean; version: number; created_at: string; updated_at: string}
type Meta = {page: number; last_page: number; total: number}
type Detail = {data: Ticket; messages: {side: string; author: string; body: string; created_at: string}[]; meta: Meta}
const actionKey = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('')
const errorText = (error: unknown) => error instanceof ApiError ? error.fieldError('subject') ?? error.fieldError('body') ?? error.message : error instanceof Error ? error.message : ''

function StateBadge({state}: {state: State}) {
  const intl = useIntl()
  const color = ({abierto: 'primary', en_proceso: 'info', esperando_colegio: 'warning', resuelto: 'success', cerrado: 'secondary'} as const)[state]
  return <span className={'badge badge-light-' + color}>{intl.formatMessage({id: 'support.state.' + state})}</span>
}

export default function SupportPage() {
  const {currentUser} = useAuth()
  const {token} = useParams()
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const platform = currentUser?.is_platform === true
  const allowed = platform ? currentUser.roles.includes('superadmin') : !!currentUser?.roles.includes('rector') && !currentUser.is_superadmin
  const endpoint = platform ? '/platform/support/tickets' : '/support/tickets'
  const root = platform ? 'support-inbox' : 'support-tickets'
  const context = [root, currentUser?.id, currentUser?.tenant_channel] as const
  return <>
    <PageTitle>{t('support.title')}</PageTitle>
    <Content>
      <div className='card mb-6'><div className='card-body p-6 p-md-8 d-flex align-items-start gap-5'>
        <div className='symbol symbol-50px flex-shrink-0'><span className='symbol-label bg-light-primary'><i className='ki-solid ki-messages fs-1 text-primary' aria-hidden='true' /></span></div>
        <div><span className='text-primary fw-semibold fs-7'>GirGit Software</span>
          <h1 className='fs-2 fw-bold mt-2 mb-3'>{t(platform ? 'support.inbox' : 'support.title')}</h1>
          <p className='text-gray-600 mb-0'>{t(platform ? 'support.platformHelp' : 'support.help')}</p>
        </div>
      </div></div>
      {!allowed ? <div className='card'><div className='card-body'><p className='mb-0'>{t('support.rectorOnly')}</p></div></div>
        : token ? <TicketConversation key={token} token={token} endpoint={endpoint} context={context} platform={platform} />
        : <TicketList endpoint={endpoint} context={context} platform={platform} />}
    </Content>
  </>
}

function TicketList({endpoint, context, platform}: {endpoint: string; context: readonly unknown[]; platform: boolean}) {
  const intl = useIntl(), navigate = useNavigate(), client = useQueryClient()
  const t = (id: string) => intl.formatMessage({id})
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  useEffect(() => {const timer = setTimeout(() => {setTerm(search); setPage(1)}, 300); return () => clearTimeout(timer)}, [search])
  const query = useQuery({queryKey: [...context, 'list', status, term, page],
    queryFn: () => api.get<{data: Ticket[]; meta: Meta}>(endpoint + '?page=' + page + '&status=' + status + '&q=' + encodeURIComponent(term))})
  return <>
    {!platform && <div className='d-flex justify-content-end mb-5'><button className='btn btn-primary' onClick={() => setCreating(value => !value)}>
      {t(creating ? 'support.cancel' : 'support.new')}
    </button></div>}
    {creating && <NewTicket endpoint={endpoint} onCreated={ticket => {
      void client.invalidateQueries({queryKey: context}); navigate('/soporte/' + ticket.token)
    }} />}
    <section className='card'>
      <div className='card-header align-items-center gap-4 py-5'>
        <h2 className='card-title mb-0 fs-4'>{t(platform ? 'support.inbox' : 'support.myTickets')}</h2>
        <div className='d-flex flex-wrap gap-3 support-filters'>
          <input type='search' className='form-control form-control-sm' maxLength={120} value={search}
            aria-label={t('support.search')} placeholder={t('support.search')} onChange={event => setSearch(event.target.value)} />
          <select className='form-select form-select-sm' aria-label={t('support.status')} value={status} onChange={event => {setStatus(event.target.value); setPage(1)}}>
            <option value=''>{t('support.allStates')}</option>
            {states.map(value => <option value={value} key={value}>{t('support.state.' + value)}</option>)}
          </select>
        </div>
      </div>
      <div className='card-body p-5 p-md-7'>
        {query.isPending ? <p role='status'>{t('common.pleaseWait')}</p> : query.isError ? <LoadError error={query.error} retry={() => void query.refetch()} />
          : !query.data.data.length ? <div className='text-center py-10'><i className='ki-solid ki-messages fs-3x text-gray-400' aria-hidden='true' /><p className='mt-4 mb-0 text-gray-600'>{t('support.empty')}</p></div>
          : <div className='d-flex flex-column gap-4'>{query.data.data.map(ticket => <Link className='support-ticket border rounded-3 p-5' to={'/soporte/' + ticket.token} key={ticket.token}>
            <div className='d-flex flex-wrap align-items-center gap-3 mb-3'><span className='fs-7 text-gray-500'>{ticket.reference}</span><StateBadge state={ticket.status} />
              {ticket.priority && <span className='badge badge-light-warning'>{t('support.priority')}</span>}
            </div>
            <h3 className='fs-5 fw-semibold text-gray-900 mb-3 text-break'>{ticket.subject}</h3>
            <div className='d-flex flex-wrap justify-content-between gap-3 fs-7 text-gray-600'>
              <span>{platform ? ticket.school + ' · ' : ''}{t('support.category.' + ticket.category)}{ticket.origin !== ticket.school ? ' · ' + ticket.origin : ''}</span>
              <time dateTime={ticket.updated_at}>{intl.formatDate(ticket.updated_at, {dateStyle:'medium', timeStyle:'short'})}</time>
            </div>
          </Link>)}</div>}
        {query.data && <Pager meta={query.data.meta} change={setPage} />}
      </div>
    </section>
  </>
}

function NewTicket({endpoint, onCreated}: {endpoint: string; onCreated: (ticket: Ticket) => void}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [subject, setSubject] = useState(''), [category, setCategory] = useState('tecnico'), [body, setBody] = useState('')
  const [key, setKey] = useState(actionKey)
  const create = useMutation({mutationFn: () => api.post<{data: Ticket}>(endpoint, {subject, category, body, request_key: key}), onSuccess: data => onCreated(data.data)})
  const edit = () => {setKey(actionKey()); create.reset()}
  return <form className='card mb-6' onSubmit={event => {event.preventDefault(); if (!create.isPending) create.mutate()}}>
    <div className='card-header'><h2 className='card-title fs-4'>{t('support.new')}</h2></div>
    <fieldset className='card-body' disabled={create.isPending}>
      {create.isError && <div className='alert alert-danger' role='alert'>{errorText(create.error)}</div>}
      <div className='row g-5'>
        <div className='col-md-8'><label className='form-label' htmlFor='ticket-subject'>{t('support.subject')}</label>
          <input id='ticket-subject' className='form-control' required minLength={5} maxLength={160} value={subject} onChange={event => {setSubject(event.target.value); edit()}} /></div>
        <div className='col-md-4'><label className='form-label' htmlFor='ticket-category'>{t('support.category')}</label>
          <select id='ticket-category' className='form-select' value={category} onChange={event => {setCategory(event.target.value); edit()}}>
            {categories.map(value => <option key={value} value={value}>{t('support.category.' + value)}</option>)}
          </select></div>
        <div className='col-12'><label className='form-label' htmlFor='ticket-body'>{t('support.description')}</label>
          <textarea id='ticket-body' className='form-control' rows={5} required minLength={10} maxLength={8000} value={body} onChange={event => {setBody(event.target.value); edit()}} />
          <p className='form-text mb-0'>{t('support.descriptionHelp')}</p></div>
      </div>
      <p className='text-gray-600 fs-7 mt-5 mb-0'>{t('support.accessHelp')}</p>
    </fieldset>
    <div className='card-footer text-end'><button className='btn btn-primary' disabled={create.isPending}>{t(create.isPending ? 'common.pleaseWait' : 'support.submit')}</button></div>
  </form>
}

function TicketConversation({token, endpoint, context, platform}: {token: string; endpoint: string; context: readonly unknown[]; platform: boolean}) {
  const intl = useIntl(), client = useQueryClient()
  const t = (id: string) => intl.formatMessage({id})
  const [page, setPage] = useState<number | null>(null)
  const [body, setBody] = useState(''), [key, setKey] = useState(actionKey)
  const [selectedStatus, setSelectedStatus] = useState('')
  const query = useQuery({queryKey: [...context, 'ticket', token, page],
    queryFn: () => api.get<Detail>(endpoint + '/' + encodeURIComponent(token) + (page ? '?messages_page=' + page : ''))})
  const refresh = () => {setPage(null); void client.invalidateQueries({queryKey: context})}
  const reply = useMutation({mutationFn: () => api.post(endpoint + '/' + token + '/messages', {body, request_key:key}),
    onSuccess: () => {setBody(''); setKey(actionKey()); refresh()},
    onError: error => {if (error instanceof ApiError && error.status === 409) void query.refetch()}})
  const change = useMutation({mutationFn: (status: string) => api.put(endpoint + '/' + token + '/state', {status, version: query.data?.data.version}),
    onSuccess: refresh, onError: error => {if (error instanceof ApiError && error.status === 409) void query.refetch()}})
  const ticket = query.data?.data
  const currentStatus = ticket?.status
  useEffect(() => {if (currentStatus) setSelectedStatus(currentStatus)}, [currentStatus])
  const submit = (event: FormEvent) => {event.preventDefault(); if (!reply.isPending && !change.isPending) reply.mutate()}
  return <>
    <Link to='/soporte' className='btn btn-light mb-5'>{t('support.back')}</Link>
    {query.isPending ? <p role='status'>{t('common.pleaseWait')}</p> : query.isError ? <LoadError error={query.error} retry={() => void query.refetch()} /> : <>
      <section className='card mb-5'><div className='card-body'>
        <div className='d-flex flex-wrap align-items-center gap-3 mb-4'><span className='text-gray-500 fs-7'>{ticket!.reference}</span><StateBadge state={ticket!.status} />
          {ticket!.priority && <span className='badge badge-light-warning'>{t('support.priority')}</span>}</div>
        <h2 className='fs-3 mb-3 text-break'>{ticket!.subject}</h2>
        <p className='text-gray-600 mb-5'>{ticket!.school} · {t('support.category.' + ticket!.category)}{ticket!.origin !== ticket!.school ? ' · ' + ticket!.origin : ''}</p>
        <div className='d-flex flex-wrap gap-3 align-items-center'>
          {platform ? <><label htmlFor='support-state' className='form-label mb-0'>{t('support.status')}</label>
            <select id='support-state' className='form-select w-auto mw-100' value={selectedStatus} disabled={change.isPending || reply.isPending} onChange={event => setSelectedStatus(event.target.value)}>
              {states.map(value => <option key={value} value={value}>{t('support.state.' + value)}</option>)}
            </select>
            <button className='btn btn-light-primary' disabled={change.isPending || reply.isPending || selectedStatus === ticket!.status} onClick={() => change.mutate(selectedStatus)}>{t('support.updateState')}</button></>
            : <>{['cerrado','resuelto'].includes(ticket!.status) && <button className='btn btn-light-primary' disabled={change.isPending || reply.isPending} onClick={() => change.mutate('abierto')}>{t('support.reopen')}</button>}
              {ticket!.status !== 'cerrado' && <button className='btn btn-light' disabled={change.isPending || reply.isPending} onClick={() => change.mutate('cerrado')}>{t('support.close')}</button>}</>}
        </div>
        {change.isError && <div className='alert alert-danger mt-4 mb-0' role='alert'>{errorText(change.error)}</div>}
      </div></section>
      <section className='card'><div className='card-header'><h2 className='card-title fs-4'>{t('support.conversation')}</h2></div>
        <div className='card-body d-flex flex-column gap-5'>
          <Pager meta={query.data.meta} change={setPage} />
          {query.data.messages.map((message, index) => <article className={'support-message p-5 rounded-3' + (message.side === 'plataforma' ? ' support-message--team' : '')} key={query.data.meta.page + ':' + index}>
            <div className='d-flex flex-wrap justify-content-between gap-2 mb-3 fs-7'><strong>{message.side === 'plataforma' ? 'GirGit Software · ' : ''}{message.author}</strong>
              <time className='text-gray-600' dateTime={message.created_at}>{intl.formatDate(message.created_at, {dateStyle:'medium', timeStyle:'short'})}</time></div>
            <div className='support-message__body'>{message.body}</div>
          </article>)}
        </div>
        {ticket!.status === 'cerrado' ? <div className='card-footer text-gray-600'>{t('support.closedHelp')}</div>
          : <form className='card-footer' onSubmit={submit}>
            {reply.isError && <div className='alert alert-danger' role='alert'>{errorText(reply.error)}</div>}
            <label className='form-label fw-semibold' htmlFor='support-reply'>{t('support.reply')}</label>
            <textarea id='support-reply' className='form-control mb-4' rows={4} required minLength={2} maxLength={8000} disabled={reply.isPending} value={body}
              onChange={event => {setBody(event.target.value); setKey(actionKey()); reply.reset()}} />
            <div className='text-end'><button className='btn btn-primary' disabled={reply.isPending || change.isPending}>{t(reply.isPending ? 'common.pleaseWait' : 'support.send')}</button></div>
          </form>}
      </section>
    </>}
  </>
}

function LoadError({error, retry}: {error: Error; retry: () => void}) {
  const intl = useIntl()
  return <div className='alert alert-danger' role='alert'>{error.message}<button className='btn btn-sm btn-light ms-3' onClick={retry}>{intl.formatMessage({id:'support.retry'})}</button></div>
}

function Pager({meta, change}: {meta: Meta; change: (page: number) => void}) {
  const intl = useIntl()
  if (meta.last_page <= 1) return null
  return <nav className='d-flex flex-wrap justify-content-center align-items-center gap-4 mt-5' aria-label={intl.formatMessage({id:'support.pages'})}>
    <button className='btn btn-sm btn-light' disabled={meta.page <= 1} onClick={() => change(meta.page - 1)}>{intl.formatMessage({id:'support.previous'})}</button>
    <span className='text-gray-600 fs-7'>{meta.page} / {meta.last_page}</span>
    <button className='btn btn-sm btn-light' disabled={meta.page >= meta.last_page} onClick={() => change(meta.page + 1)}>{intl.formatMessage({id:'support.next'})}</button>
  </nav>
}
