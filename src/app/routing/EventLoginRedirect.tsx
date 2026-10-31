import {Navigate, useLocation} from 'react-router-dom'
import {useDraftStore} from '@/lib/drafts/WorkDrafts'
import {safeDraftPath} from '@/lib/drafts/crypto'

/** Carry only the event's public selector through login; never arbitrary redirect URLs. */
export function EventLoginRedirect({authenticated = false}: {authenticated?: boolean}) {
  const {pathname, search, state} = useLocation()
  const store = useDraftStore()
  const token = new URLSearchParams(search).get('evento')
  const valid = token && /^[A-Za-z0-9_-]{24}$/.test(token)
  if (authenticated && store && !store.ready) return null
  const previous = [...(store?.entries.values() ?? [])].filter(row => row.context === '$route')
    .sort((a, b) => b.editedAt - a.editedAt)[0]?.path
  const to = authenticated
    ? valid ? `/comunicacion/eventos?evento=${token}` : safeDraftPath(state?.returnTo) ?? safeDraftPath(previous) ?? '/dashboard'
    : pathname === '/comunicacion/eventos' && valid ? `/auth?evento=${token}` : '/auth'
  return <Navigate to={to} replace state={authenticated ? null : {returnTo: safeDraftPath(pathname + search)}} />
}
