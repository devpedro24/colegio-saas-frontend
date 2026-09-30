import {NavLink} from 'react-router-dom'
import {FormattedMessage, useIntl} from 'react-intl'
import {useAuth} from '../auth'
import {roleLabels, userInitials} from './accountPresentation'
import {useAccountInstitution} from './useAccountInstitution'

export function AccountHeader() {
  const {currentUser} = useAuth()
  const intl = useIntl()
  const institution = useAccountInstitution()
  return <section className='card mb-6 account-summary'>
    <div className='card-body p-6 p-md-9 pb-0 pb-md-0'>
      <div className='d-flex flex-wrap align-items-center gap-5 mb-7'>
        <div className='symbol symbol-70px symbol-md-90px flex-shrink-0'>
          <span className='symbol-label bg-light-primary text-primary fw-bold fs-2x' aria-hidden='true'>{userInitials(currentUser?.name)}</span>
        </div>
        <div className='flex-grow-1 min-w-0'>
          <div className='text-muted fw-semibold mb-2'><FormattedMessage id='header.user.myProfile' /></div>
          <h1 className='fs-2 fw-bold text-break mb-2'>{currentUser?.name}</h1>
          <p className='text-gray-600 text-break fs-6 mb-3'>{currentUser?.email}</p>
          <div className='d-flex flex-wrap gap-2'>
            <span className='badge badge-light text-wrap'>{roleLabels(currentUser, intl)}</span>
            {institution?.plan && <span className='badge badge-light-primary text-wrap'>{institution.plan.name}</span>}
            <span className={`badge badge-light-${currentUser?.mfa_enabled ? 'success' : 'primary'}`}><FormattedMessage id={currentUser?.mfa_enabled ? 'account.security.active' : 'account.security.pending'} /></span>
          </div>
        </div>
      </div>
      <p className='text-gray-600 mb-6 fs-6'><FormattedMessage id='account.personalHelp' /></p>
      <nav className='nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-bold account-summary__tabs' aria-label={intl.formatMessage({id: 'header.user.myProfile'})}>
        <NavLink to='/account/overview' className={({isActive}) => `nav-link text-active-primary me-10 py-5${isActive ? ' active' : ''}`}><FormattedMessage id='account.tab.overview' /></NavLink>
        <NavLink to='/account/settings' className={({isActive}) => `nav-link text-active-primary me-10 py-5${isActive ? ' active' : ''}`}><FormattedMessage id='header.user.accountSettings' /></NavLink>
      </nav>
    </div>
  </section>
}
