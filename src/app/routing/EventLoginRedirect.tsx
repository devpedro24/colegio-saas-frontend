import {Navigate, useLocation} from 'react-router-dom'

/** Carry only the event's public selector through login; never arbitrary redirect URLs. */
export function EventLoginRedirect({authenticated = false}: {authenticated?: boolean}) {
  const {pathname, search} = useLocation()
  const token = new URLSearchParams(search).get('evento')
  const valid = token && /^[A-Za-z0-9_-]{24}$/.test(token)
  const to = authenticated
    ? valid ? `/comunicacion/eventos?evento=${token}` : '/dashboard'
    : pathname === '/comunicacion/eventos' && valid ? `/auth?evento=${token}` : '/auth'
  return <Navigate to={to} replace />
}
