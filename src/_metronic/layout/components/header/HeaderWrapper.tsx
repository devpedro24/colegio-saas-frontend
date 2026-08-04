import {useEffect} from 'react'
import {useIntl} from 'react-intl'
import clsx from 'clsx'
import {Link} from 'react-router-dom'
import {Modal} from 'bootstrap'
import {KTIcon, reInitMenu} from '../../../helpers'
import {LayoutSetup, useLayout} from '../../core'
import {Header} from './Header'
import {Navbar} from './Navbar'

export function HeaderWrapper() {
  const {config, classes} = useLayout()
  const intl = useIntl()
  if (config.app?.header?.default?.container === 'fluid') {
    LayoutSetup.classes.headerContainer.push('container-fluid')
  } else {
    LayoutSetup.classes.headerContainer.push('container-xxl')
  }

  // El header se porta como HTML de demo46 (menu + navbar). Reinicializa KTMenu para que
  // los mega-menus/dropdowns abran por hover, y cablea los modales (data-bs-toggle/dismiss)
  // ya que este proyecto no carga el data-api completo de Bootstrap.
  useEffect(() => {
    reInitMenu()

    const onClick = (e: Event) => {
      const target = e.target as HTMLElement
      const toggle = target.closest('[data-bs-toggle="modal"]')
      if (toggle) {
        const selector = toggle.getAttribute('data-bs-target')
        const el = selector ? document.querySelector(selector) : null
        if (el) {
          e.preventDefault()
          Modal.getOrCreateInstance(el as HTMLElement).show()
        }
        return
      }
      const dismiss = target.closest('[data-bs-dismiss="modal"]')
      if (dismiss) {
        const modalEl = dismiss.closest('.modal')
        if (modalEl) {
          Modal.getOrCreateInstance(modalEl as HTMLElement).hide()
        }
      }
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  if (!config.app?.header?.display) {
    return null
  }

  return (
    <div id='kt_app_header' className='app-header'>
      {/* begin::Header container */}
      <div
        id='kt_app_header_container'
        className={clsx(
          'app-container',
          classes.headerContainer.join(' '),
          config.app?.header?.default?.containerClass
        )}
      >
        {/* begin::Header mobile toggle */}
        {config.app?.sidebar?.display && (
          <div
            className='d-flex align-items-center d-lg-none ms-n2 me-2'
            title={intl.formatMessage({
              id: 'header.toggle.sidebarMenu',
              defaultMessage: 'Mostrar menú lateral',
            })}
          >
            <div
              className='btn btn-icon btn-color-white btn-active-color-primary w-35px h-35px'
              id='kt_app_sidebar_mobile_toggle'
            >
              <KTIcon iconName='abstract-14' className='fs-2' />
            </div>
          </div>
        )}
        {/* end::Header mobile toggle */}

        {/* begin::Logo */}
        <div className='d-flex align-items-center flex-grow-1 flex-lg-grow-0 me-5 me-lg-0'>
          <Link to='/dashboard' className='d-flex align-items-center text-white text-hover-white'>
            <span className='fs-2 fw-bold d-none d-sm-inline'>Colegio SaaS</span>
            <span className='fs-3 fw-bold d-inline d-sm-none'>Colegio</span>
          </Link>
        </div>
        {/* end::Logo */}

        {/* begin::Header wrapper */}
        <div
          id='kt_app_header_wrapper'
          className='d-flex align-items-stretch justify-content-between flex-lg-grow-1'
        >
          {config.app.header.default?.content === 'menu' &&
            config.app.header.default.menu?.display && (
              // SOLO DESKTOP: en movil el menu Apps vive en el sidebar drawer. Sin drawer/swapper.
              <div
                id='kt_app_header_menu_wrapper'
                className='app-header-menu align-items-stretch d-none d-lg-flex'
              >
                <Header />
              </div>
            )}
          <Navbar />
        </div>
        {/* end::Header wrapper */}
      </div>
      {/* end::Header container */}
    </div>
  )
}
