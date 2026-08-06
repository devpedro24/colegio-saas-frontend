import {Link} from 'react-router-dom'
import {FormattedMessage} from 'react-intl'
import {useAuth} from '../../auth'

// Account Overview (demo46 account/overview.html): card "Profile Details" con
// los DATOS REALES del usuario autenticado (sin widgets decorativos ni datos
// hardcodeados). El botón "Editar perfil" lleva a /account/settings.
export function Overview() {
  const {currentUser} = useAuth()

  const user = currentUser

  const roleLabel = user?.is_platform
    ? 'Super administrador (plataforma)'
    : (user?.roles ?? []).join(', ')

  return (
    <div className='card mb-5 mb-xl-10' id='kt_profile_details_view'>
      {/* begin::Card header */}
      <div className='card-header cursor-pointer'>
        <div className='card-title m-0'>
          <h3 className='fw-bold m-0'>
            <FormattedMessage id='account.profileDetails' defaultMessage='Detalles del perfil' />
          </h3>
        </div>

        <Link to='/account/settings' className='btn btn-sm btn-primary align-self-center'>
          <FormattedMessage id='account.overview.editProfile' defaultMessage='Editar perfil' />
        </Link>
      </div>
      {/* end::Card header */}

      {/* begin::Card body */}
      <div className='card-body p-9'>
        <div className='row mb-7'>
          <label className='col-lg-4 fw-semibold text-muted'>
            <FormattedMessage id='common.name' defaultMessage='Nombre completo' />
          </label>
          <div className='col-lg-8'>
            <span className='fw-bold fs-6 text-gray-800'>{user?.name ?? '—'}</span>
          </div>
        </div>

        <div className='row mb-7'>
          <label className='col-lg-4 fw-semibold text-muted'>
            <FormattedMessage id='common.field.rol' defaultMessage='Rol' />
          </label>
          <div className='col-lg-8'>
            <span className='fw-semibold fs-6 text-gray-800'>{roleLabel || '—'}</span>
          </div>
        </div>

        <div className='row mb-7'>
          <label className='col-lg-4 fw-semibold text-muted'>
            <FormattedMessage id='common.email' defaultMessage='Correo electrónico' />
          </label>
          <div className='col-lg-8'>
            <span className='fw-bold fs-6 text-gray-800'>{user?.email ?? '—'}</span>
          </div>
        </div>

        <div className='row mb-7'>
          <label className='col-lg-4 fw-semibold text-muted'>
            <FormattedMessage id='account.field.contactPhone' defaultMessage='Teléfono de contacto' />
          </label>
          <div className='col-lg-8'>
            <span className='fw-bold fs-6 text-gray-800'>{user?.phone || '—'}</span>
          </div>
        </div>

        <div className='row mb-0'>
          <label className='col-lg-4 fw-semibold text-muted'>
            <FormattedMessage id='account.overview.googleAccount' defaultMessage='Cuenta de Google' />
          </label>
          <div className='col-lg-8'>
            <span className='fw-bold fs-6 text-gray-800'>
              {user?.google_email ? user.google_email : '—'}
            </span>
          </div>
        </div>
      </div>
      {/* end::Card body */}
    </div>
  )
}