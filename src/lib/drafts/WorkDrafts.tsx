import {createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode} from 'react'
import {Link, useLocation} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {Modal} from 'react-bootstrap'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {DraftStore, type WorkDraft} from './store'
import {newDraftToken, safeDraftPath} from './crypto'
import {draftPreview} from './preview'

const Context = createContext<DraftStore | null>(null)
const nothing = () => () => {}; const zero = () => 0
// The provider and its hooks intentionally share this private context.
// eslint-disable-next-line react-refresh/only-export-components
export function useDraftStore() {
  const store = useContext(Context)
  useSyncExternalStore(store?.subscribe ?? nothing, store?.snapshot ?? zero)
  return store
}
export function WorkDraftProvider({children}: {children: ReactNode}) {
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const identity = currentUser ? `${currentUser.id}:${activeColegio?.slug ?? ''}` : ''
  const endpoint = currentUser?.is_platform && !activeColegio ? '/platform/work-drafts' : '/work-drafts'
  return <DraftSession key={identity} identity={identity} endpoint={endpoint}>{children}</DraftSession>
}
function DraftSession({identity, endpoint, children}: {identity: string; endpoint: string; children: ReactNode}) {
  const [store] = useState(() => identity ? new DraftStore(endpoint) : null)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!store) return
    clearTimeout(stopTimer.current)
    void store.start()
    const flush = () => {void store.flush()}
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {window.removeEventListener('online', flush); document.removeEventListener('visibilitychange', flush); stopTimer.current = setTimeout(() => store.stop(), 0)}
  }, [store])
  return <Context.Provider value={store}><RememberWorkRoute />{children}</Context.Provider>
}
function RememberWorkRoute() {
  const store = useDraftStore(); const location = useLocation()
  const routeToken = useRef(newDraftToken())
  const [activation, setActivation] = useState(0)
  useEffect(() => {
    const active = () => {if (document.visibilityState === 'visible') setActivation(value => value + 1)}
    document.addEventListener('visibilitychange', active)
    return () => document.removeEventListener('visibilitychange', active)
  }, [])
  const path = safeDraftPath(location.pathname + location.search)
  useEffect(() => {
    if (!store?.key || !path || path === '/mis-borradores' || document.visibilityState !== 'visible') return
    const timer = setTimeout(() => {
      if (store.records.get(routeToken.current)?.discarded) routeToken.current = newDraftToken()
      // A route is encrypted like any other draft; it contains no credentials.
      store.write(routeToken.current, {schema: 1, context: '$route', title: '', path, base: '', value: null})
    }, 500)
    return () => clearTimeout(timer)
  }, [store, store?.ready, path, activation])
  return null
}

type Options<T> = {
  context: string; title: string; value: T; dirty: boolean; base?: string; enabled?: boolean
  restore: (value: T) => void; reset?: () => void; compatible?: (value: T, base: string) => boolean
  files?: string[]
  editIdentity?: (value: T) => unknown
}
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkDraft<T>(options: Options<T>) {
  const store = useDraftStore(); const location = useLocation(); const intl = useIntl()
  const token = useRef(newDraftToken()); const parent = useRef<string | null>(null)
  const context = useRef(options.context)
  const serialized = JSON.stringify(options.value)
  const editSignature = JSON.stringify(options.editIdentity ? options.editIdentity(options.value) : options.value)
  const latest = useRef(serialized); latest.current = serialized
  const lastWritten = useRef(''); const [ignored, setIgnored] = useState<string[]>([])
  const editClock = useRef<{signature: string; time: number} | null>(null)
  const restoredTime = useRef<number | null>(null)
  if (context.current !== options.context) {
    context.current = options.context; token.current = newDraftToken(); parent.current = null; lastWritten.current = ''
    editClock.current = null; restoredTime.current = null
  }
  const [inspect, setInspect] = useState<WorkDraft | null>(null)
  const base = options.base ?? ''
  const capturedBase = useRef(base)
  if (!options.dirty) capturedBase.current = base
  useEffect(() => {
    if (!store?.key || !options.dirty || serialized === lastWritten.current) return
    lastWritten.current = serialized
    if (!editClock.current || editClock.current.signature !== editSignature || restoredTime.current !== null)
      editClock.current = {signature: editSignature, time: restoredTime.current ?? store.now()}
    restoredTime.current = null
    store.write(token.current, {schema: 1, context: options.context, title: options.title,
      path: safeDraftPath(location.pathname + location.search) ?? '/dashboard', base: capturedBase.current,
      value: JSON.parse(serialized), files: options.files}, editClock.current.time)
  }, [store, store?.ready, serialized, editSignature, options.dirty, options.context, options.title, options.files, location.pathname, location.search])
  const candidates = [...(store?.entries.values() ?? [])].filter(item => item.context === options.context
    && (!options.dirty || item.token !== token.current) && !ignored.includes(item.token) && item.expiresAt > (store?.now() ?? Date.now()))
    .sort((a, b) => b.editedAt - a.editedAt)
  const candidate = candidates[0]
  const current = store?.entries.get(token.current)
  const compatible = candidate && (options.compatible ? options.compatible(candidate.value as T, candidate.base) : candidate.base === base)
  const enabled = options.enabled !== false
  const discard = async () => {
    if (store) {
      await store.discard(token.current)
      if (parent.current) await store.discard(parent.current)
    }
    token.current = newDraftToken(); parent.current = null; lastWritten.current = ''
    editClock.current = null; restoredTime.current = null
    options.reset?.()
  }
  // Capture the submitted content. A successful older request must not erase later typing.
  const afterSave = () => {
    const submitted = serialized; const submittedToken = token.current; const submittedParent = parent.current
    return (force: unknown = false) => {
      if (force !== true && latest.current !== submitted) return
      void store?.discard(submittedToken)
      if (submittedParent) void store?.discard(submittedParent)
      token.current = newDraftToken(); parent.current = null; lastWritten.current = latest.current
      editClock.current = null; restoredTime.current = null
    }
  }
  const t = (id: string) => intl.formatMessage({id})
  const notice = <>
    {store?.error && options.dirty && <div className='alert alert-warning text-gray-800' role='alert'>{t('drafts.unavailable')}</div>}
    {candidate && !options.dirty && <div className='alert alert-warning text-gray-800 d-flex flex-wrap align-items-center gap-4 my-4' role='status'>
      <div className='flex-grow-1'><strong>{t('drafts.found')}</strong><div>{candidate.title}</div>
        <small>{t('drafts.edited')} {intl.formatDate(candidate.editedAt, {dateStyle: 'short', timeStyle: 'short'})} · {t('drafts.expires')} {intl.formatDate(candidate.expiresAt, {dateStyle: 'short', timeStyle: 'short'})}</small>
        {(!compatible || !enabled) && <p className='mb-0 mt-2'>{t(!enabled ? 'drafts.blocked' : 'drafts.conflict')}</p>}
      </div>
      <button type='button' className='btn btn-sm btn-warning text-dark' disabled={!enabled || !compatible} onClick={() => {
        if (candidate.token === token.current) token.current = newDraftToken()
        parent.current = candidate.token; capturedBase.current = candidate.base
        restoredTime.current = serialized === JSON.stringify(candidate.value) ? null : candidate.editedAt
        options.restore(candidate.value as T); setIgnored(items => [...items, candidate.token])
      }}>{t('drafts.restore')}</button>
      <button type='button' className='btn btn-sm btn-light' onClick={() => setInspect(candidate)}>{t('drafts.inspect')}</button>
      <button type='button' className='btn btn-sm btn-light-danger' onClick={() => {void store?.discard(candidate.token)}}>{t('drafts.discard')}</button>
    </div>}
    {options.dirty && current && <div className={`alert ${current.status === 'error' ? 'alert-warning' : 'alert-light border'} d-flex flex-wrap align-items-center gap-3 my-3`} role='status'>
      <span className='flex-grow-1 text-gray-800'>{t('drafts.pending')} · {t(`drafts.${current.status}`)} {current.status !== 'saving' && intl.formatTime(current.editedAt)}
        <small className='d-block text-muted'>{t('drafts.manual')}</small></span>
      {options.reset && <button type='button' className='btn btn-sm btn-light-danger' onClick={() => {void discard()}}>{t('drafts.discard')}</button>}
    </div>}
    <Modal show={!!inspect} onHide={() => setInspect(null)} centered size='lg'>
      <Modal.Header closeButton><Modal.Title>{t('drafts.inspect')}</Modal.Title></Modal.Header>
      <Modal.Body><p>{t('drafts.reviewHelp')}</p><div style={{maxHeight: '50vh', overflow: 'auto'}}>
        {draftPreview(inspect?.value).map((line, index) => <p key={index} className='border-bottom pb-3' style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{line}</p>)}
      </div></Modal.Body>
    </Modal>
  </>
  return {notice, afterSave, discard}
}

export function MyDrafts() {
  const store = useDraftStore(); const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const rows = [...(store?.entries.values() ?? [])].filter(item => item.context !== '$route' && item.expiresAt > (store?.now() ?? Date.now()))
    .sort((a, b) => b.editedAt - a.editedAt)
  return <div className='card'><div className='card-header'><h2 className='card-title'>{t('drafts.title')}</h2></div>
    <div className='card-body'><p className='text-muted'>{t('drafts.help')}</p>
      {!store?.ready ? <p role='status'>{t('drafts.loading')}</p> : store.error ? <div className='alert alert-warning text-gray-800'>{t('drafts.unavailable')}</div> : null}
      {store?.ready && !rows.length && <p>{t('drafts.empty')}</p>}
      {rows.map(row => <div key={row.token} className='border-bottom py-4 d-flex align-items-center flex-wrap gap-4'>
        <div className='flex-grow-1'><strong>{row.title}</strong><div className='text-muted'>{t('drafts.edited')} {intl.formatDate(row.editedAt, {dateStyle: 'short', timeStyle: 'short'})} · {t('drafts.expires')} {intl.formatDate(row.expiresAt, {dateStyle: 'short', timeStyle: 'short'})}</div></div>
        <Link to={safeDraftPath(row.path) ?? '/dashboard'} className='btn btn-sm btn-light-primary'>{t('drafts.open')}</Link>
        <button className='btn btn-sm btn-light-danger' onClick={() => {void store?.discard(row.token)}}>{t('drafts.discard')}</button>
      </div>)}
    </div></div>
}
