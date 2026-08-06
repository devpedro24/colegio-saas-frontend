import {FC, useEffect} from 'react'
import {Link, useLocation} from 'react-router-dom'
import {FormattedMessage, useIntl} from 'react-intl'
import {KTIcon, reInitMenu, toAbsoluteUrl} from '../../../_metronic/helpers'

// Header de cuenta con el diseno de demo46 (account/overview.html). Se quitaron a peticion:
// los 3 stat boxes (Earnings/Projects/Success Rate) y los botones Follow y Hire Me. "Upgrade
// to Pro" tampoco existe en demo46, se omite. Se conservan avatar, nombre+verify, info,
// menu de 3 puntos, barra de Profile Completion y tabs Overview/Settings.
const AccountHeader: FC = () => {
  const location = useLocation()
  const intl = useIntl()

  useEffect(() => {
    reInitMenu()
  }, [])

  return (
    <div className='card mb-5 mb-xl-10'>
      <div className='card-body pt-9 pb-0'>
            {/* begin::Details */}
            <div className='d-flex flex-wrap flex-sm-nowrap'>
              {/* begin::Pic */}
              <div className='me-7 mb-4'>
                <div className='symbol symbol-100px symbol-lg-160px symbol-fixed position-relative'>
                  <img src={toAbsoluteUrl('media/avatars/300-1.jpg')} alt='Max Smith' />
                  <div className='position-absolute translate-middle bottom-0 start-100 mb-6 bg-success rounded-circle border border-4 border-body h-20px w-20px'></div>
                </div>
              </div>
              {/* end::Pic */}

              {/* begin::Info */}
              <div className='flex-grow-1'>
                {/* begin::Title */}
                <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                  {/* begin::User */}
                  <div className='d-flex flex-column'>
                    {/* begin::Name */}
                    <div className='d-flex align-items-center mb-2'>
                      <a href='#' className='text-gray-900 text-hover-primary fs-2 fw-bold me-1'>
                        Max Smith
                      </a>
                      <a href='#'>
                        <KTIcon iconName='verify' className='fs-1 text-primary' />
                      </a>
                    </div>
                    {/* end::Name */}

                    {/* begin::Info */}
                    <div className='d-flex flex-wrap fw-semibold fs-6 mb-4 pe-2'>
                      <a
                        href='#'
                        className='d-flex align-items-center text-gray-500 text-hover-primary me-5 mb-2'
                      >
                        <KTIcon iconName='profile-circle' className='fs-4 me-1' />
                        Developer
                      </a>
                      <a
                        href='#'
                        className='d-flex align-items-center text-gray-500 text-hover-primary me-5 mb-2'
                      >
                        <KTIcon iconName='geolocation' className='fs-4 me-1' />
                        SF, Bay Area
                      </a>
                      <a
                        href='#'
                        className='d-flex align-items-center text-gray-500 text-hover-primary mb-2'
                      >
                        <KTIcon iconName='sms' className='fs-4 me-1' />
                        max@kt.com
                      </a>
                    </div>
                    {/* end::Info */}
                  </div>
                  {/* end::User */}

                  {/* begin::Actions */}
                  <div className='d-flex my-4'>
                    {/* begin::Menu */}
                    <div className='me-0'>
                      <button
                        className='btn btn-sm btn-icon btn-bg-light btn-active-color-primary'
                        data-kt-menu-trigger='click'
                        data-kt-menu-placement='bottom-end'
                      >
                        <i className='ki-solid ki-dots-horizontal fs-2x'></i>
                      </button>
                      {/* begin::Menu 3 */}
                      <div
                        className='menu menu-sub menu-sub-dropdown menu-column menu-rounded menu-gray-800 menu-state-bg-light-primary fw-semibold w-200px py-3'
                        data-kt-menu='true'
                      >
                        <div className='menu-item px-3'>
                          <div className='menu-content text-muted pb-2 px-3 fs-7 text-uppercase'>
                            <FormattedMessage id='common.payments' defaultMessage='Pagos' />
                          </div>
                        </div>
                        <div className='menu-item px-3'>
                          <a href='#' className='menu-link px-3'>
                            <FormattedMessage
                              id='account.menu.createInvoice'
                              defaultMessage='Crear factura'
                            />
                          </a>
                        </div>
                        <div className='menu-item px-3'>
                          <a href='#' className='menu-link flex-stack px-3'>
                            <FormattedMessage
                              id='account.menu.createPayment'
                              defaultMessage='Crear pago'
                            />
                            <span
                              className='ms-2'
                              data-bs-toggle='tooltip'
                              title={intl.formatMessage({
                                id: 'account.menu.createPaymentTooltip',
                                defaultMessage:
                                  'Especifica un nombre de destino para uso y referencia futuros',
                              })}
                            >
                              <KTIcon iconName='information' className='fs-6' />
                            </span>
                          </a>
                        </div>
                        <div className='menu-item px-3'>
                          <a href='#' className='menu-link px-3'>
                            <FormattedMessage
                              id='account.menu.generateBill'
                              defaultMessage='Generar recibo'
                            />
                          </a>
                        </div>
                        <div
                          className='menu-item px-3'
                          data-kt-menu-trigger='hover'
                          data-kt-menu-placement='right-end'
                        >
                          <a href='#' className='menu-link px-3'>
                            <span className='menu-title'>
                              <FormattedMessage
                                id='account.menu.subscription'
                                defaultMessage='Suscripción'
                              />
                            </span>
                            <span className='menu-arrow'></span>
                          </a>
                          <div className='menu-sub menu-sub-dropdown w-175px py-4'>
                            <div className='menu-item px-3'>
                              <a href='#' className='menu-link px-3'>
                                <FormattedMessage id='common.plans' defaultMessage='Planes' />
                              </a>
                            </div>
                            <div className='menu-item px-3'>
                              <a href='#' className='menu-link px-3'>
                                <FormattedMessage
                                  id='account.menu.billing'
                                  defaultMessage='Facturación'
                                />
                              </a>
                            </div>
                            <div className='menu-item px-3'>
                              <a href='#' className='menu-link px-3'>
                                <FormattedMessage
                                  id='account.menu.statements'
                                  defaultMessage='Estados de cuenta'
                                />
                              </a>
                            </div>
                            <div className='separator my-2'></div>
                            <div className='menu-item px-3'>
                              <div className='menu-content px-3'>
                                <label className='form-check form-switch form-check-custom form-check-solid'>
                                  <input
                                    className='form-check-input w-30px h-20px'
                                    type='checkbox'
                                    defaultChecked
                                    name='notifications'
                                  />
                                  <span className='form-check-label text-muted fs-6'>
                                    <FormattedMessage
                                      id='account.menu.recurring'
                                      defaultMessage='Recurrente'
                                    />
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className='menu-item px-3 my-1'>
                          <a href='#' className='menu-link px-3'>
                            <FormattedMessage id='account.tab.settings' defaultMessage='Configuración' />
                          </a>
                        </div>
                      </div>
                      {/* end::Menu 3 */}
                    </div>
                    {/* end::Menu */}
                  </div>
                  {/* end::Actions */}
                </div>
                {/* end::Title */}

                {/* begin::Stats (solo Profile Completion; stat boxes removidos) */}
                <div className='d-flex flex-wrap flex-stack'>
                  <div className='d-flex flex-column flex-grow-1 pe-8'></div>

                  {/* begin::Progress */}
                  <div className='d-flex align-items-center w-200px w-sm-300px flex-column mt-3'>
                    <div className='d-flex justify-content-between w-100 mt-auto mb-2'>
                      <span className='fw-semibold fs-6 text-gray-500'>
                        <FormattedMessage
                          id='account.profileCompletion'
                          defaultMessage='Perfil completado'
                        />
                      </span>
                      <span className='fw-bold fs-6'>50%</span>
                    </div>
                    <div className='h-5px mx-3 w-100 bg-light mb-3'>
                      <div
                        className='bg-success rounded h-5px'
                        role='progressbar'
                        style={{width: '50%'}}
                        aria-valuenow={50}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      ></div>
                    </div>
                  </div>
                  {/* end::Progress */}
                </div>
                {/* end::Stats */}
              </div>
              {/* end::Info */}
            </div>
            {/* end::Details */}

            {/* begin::Navs */}
            <ul className='nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-bold'>
              <li className='nav-item mt-2'>
                <Link
                  className={
                    'nav-link text-active-primary ms-0 me-10 py-5 ' +
                    (location.pathname === '/account/overview' && 'active')
                  }
                  to='/account/overview'
                >
                  <FormattedMessage id='account.tab.overview' defaultMessage='Resumen' />
                </Link>
              </li>
              <li className='nav-item mt-2'>
                <Link
                  className={
                    'nav-link text-active-primary ms-0 me-10 py-5 ' +
                    (location.pathname === '/account/settings' && 'active')
                  }
                  to='/account/settings'
                >
                  <FormattedMessage id='account.tab.settings' defaultMessage='Configuración' />
                </Link>
              </li>
            </ul>
            {/* end::Navs */}
          </div>
        </div>
  )
}

export {AccountHeader}
