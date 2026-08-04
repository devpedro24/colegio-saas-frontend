import {FC, useEffect} from 'react'
import {useIntl} from 'react-intl'
import {ILayout, useLayout} from '../../core'
import {reInitMenu, withBase} from '../../../helpers'
import {getHeaderMenuHtml} from './_HeaderMenuContent'
import {useAuth} from '../../../../app/modules/auth'
import {useImpersonation} from '../../../../app/modules/impersonation/impersonation.store'

// Menu #kt_app_header_menu portado literal de demo46 (Home / Pages / Apps / Help con
// mega-menus por hover). El comportamiento hover lo maneja KTMenu (data-kt-menu-trigger).
// i18n: el HTML se genera con intl (labels traducidos) antes de inyectarse.
// El nav se arma por modo: plataforma (superadmin sin colegio activo) o colegio (tenant o
// superadmin con un colegio activo). Al cambiar de modo se re-genera y se recablea KTMenu.
const Header: FC = () => {
  const {config} = useLayout()
  const intl = useIntl()
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()

  const isPlatform = currentUser?.is_platform === true
  const isTenantUser = !!currentUser && currentUser.is_platform !== true

  useEffect(() => {
    updateDOM(config)
  }, [config])

  // Recablea KTMenu al cambiar de modo (el HTML inyectado cambia sus secciones).
  useEffect(() => {
    reInitMenu()
  }, [activeColegio, isPlatform, isTenantUser])

  return (
    <div
      className='menu menu-rounded menu-active-bg menu-state-primary menu-column menu-lg-row menu-title-gray-700 menu-icon-gray-500 menu-arrow-gray-500 menu-bullet-gray-500 my-5 my-lg-0 align-items-stretch fw-semibold px-2 px-lg-0'
      id='kt_app_header_menu'
      data-kt-menu='true'
      dangerouslySetInnerHTML={{
        __html: withBase(
          getHeaderMenuHtml(intl, {
            isPlatform,
            isTenantUser,
            activeColegio: !!activeColegio,
          })
        ),
      }}
    />
  )
}

const updateDOM = (config: ILayout) => {
  if (config.app?.header?.default?.fixed?.desktop) {
    document.body.setAttribute('data-kt-app-header-fixed', 'true')
  }

  if (config.app?.header?.default?.fixed?.mobile) {
    document.body.setAttribute('data-kt-app-header-fixed-mobile', 'true')
  }

  if (config.app?.header?.default?.stacked) {
    document.body.setAttribute('data-kt-app-header-stacked', 'true')
  }
}

export {Header}
