import {FC} from 'react'
import {FormattedMessage} from 'react-intl'
import {Link, useLocation} from 'react-router-dom'
import {KTIcon} from '../../../_metronic/helpers'
import {useAuth} from '../auth'

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.[0] || 'U')
    .toUpperCase()
}

const AccountHeader: FC = () => {
  const location = useLocation()
  const {currentUser} = useAuth()

  const name = currentUser?.name?.trim() || currentUser?.email || 'Usuario'
  const roles = currentUser?.roles?.length
    ? currentUser.roles.join(', ')
    : currentUser?.is_platform
      ? 'Superadministrador'
      : 'Sin rol asignado'

  return (
    <div className='card mb-5 mb-xl-10'>
      <div className='card-body pt-9 pb-0'>
        <div className='d-flex flex-wrap flex-sm-nowrap align-items-center mb-6'>
          <div className='symbol symbol-75px symbol-lg-100px me-7 mb-4 mb-sm-0'>
            <span className='symbol-label bg-light-primary text-primary fs-2 fw-bold'>
              {getInitials(name)}
            </span>
          </div>

          <div className='flex-grow-1 min-w-0'>
            <h1 className='text-gray-900 fs-2 fw-bold mb-3 text-break'>{name}</h1>
            <div className='d-flex flex-wrap fw-semibold fs-6 text-gray-500 gap-3 gap-lg-5'>
              <span className='d-flex align-items-center'>
                <KTIcon iconName='profile-circle' className='fs-4 me-1' />
                {roles}
              </span>
              {currentUser?.email && (
                <span className='d-flex align-items-center text-break'>
                  <KTIcon iconName='sms' className='fs-4 me-1' />
                  {currentUser.email}
                </span>
              )}
              {currentUser?.phone && (
                <span className='d-flex align-items-center'>
                  <KTIcon iconName='phone' className='fs-4 me-1' />
                  {currentUser.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <ul className='nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-bold'>
          <li className='nav-item mt-2'>
            <Link
              className={`nav-link text-active-primary ms-0 me-10 py-5 ${
                location.pathname.startsWith('/account/overview') ? 'active' : ''
              }`}
              to='/account/overview'
            >
              <FormattedMessage id='account.tab.overview' defaultMessage='Resumen' />
            </Link>
          </li>
          <li className='nav-item mt-2'>
            <Link
              className={`nav-link text-active-primary ms-0 me-10 py-5 ${
                location.pathname.startsWith('/account/settings') ? 'active' : ''
              }`}
              to='/account/settings'
            >
              <FormattedMessage id='account.tab.settings' defaultMessage='Configuración' />
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}

export {AccountHeader}
