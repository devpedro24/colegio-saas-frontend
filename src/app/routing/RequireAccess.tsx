import {FC, ReactNode} from 'react'
import {Navigate} from 'react-router-dom'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {useAuth} from '@/app/modules/auth'

type Props = {
  children: ReactNode
  platformOnly?: boolean
  tenantOnly?: boolean
  permission?: string
  enforceMfa?: boolean
}

const RequireAccess: FC<Props> = ({children, platformOnly, tenantOnly, permission, enforceMfa}) => {
  const authz = useAuthz()
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const tenantContext = !authz.isPlatform || activeColegio !== null

  const denied =
    (platformOnly === true && !authz.isPlatform) ||
    (tenantOnly === true && !tenantContext) ||
    (permission !== undefined && !authz.isPlatform && !authz.hasPermission(permission))

  if (denied) return <Navigate to='/dashboard' replace />

  if (enforceMfa && currentUser?.mfa_setup_required === true) {
    return <Navigate to='/account/settings' replace />
  }

  return <>{children}</>
}

export {RequireAccess}
