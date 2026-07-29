/* eslint-disable no-prototype-builtins */
import {useEffect} from 'react'
import {Link} from 'react-router-dom'
import {ILayout, useLayout} from '../../core'
import {reInitMenu, withBase} from '../../../helpers'
import {HEADER_MENU_HTML} from '../header/_HeaderMenuContent'
import {MobileTeamSelector, Team} from './MobileTeamSelector'
import {DesktopTeamRail} from './DesktopTeamRail'

type AvatarItem = {
  avatar: string
  name: string
  to: string
  active?: boolean
}

// Caritas del equipo (placeholder demo). En DESKTOP son el rail de 70px (link a rutas
// internas). En MOVIL alimentan el selector "Thunder" (avatar + nombre + check).
const TEAMS: AvatarItem[] = [
  {avatar: '300-2.jpg', name: 'Karina Clark', to: '/account/overview'},
  {avatar: '300-7.jpg', name: 'Olivia Bold', to: '/account/settings', active: true},
  {avatar: '300-10.jpg', name: 'Ana Clark', to: '/account/overview'},
  {avatar: '300-1.jpg', name: 'Nick Logan', to: '/dashboard'},
  {avatar: '300-3.jpg', name: 'Kevin Leonard', to: '/account/overview'},
  {avatar: '300-21.jpg', name: 'Robert Doe', to: '/dashboard'},
  {avatar: '300-6.jpg', name: 'Emma Bold', to: '/account/settings'},
  {avatar: '300-13.jpg', name: 'Sean Bean', to: '/dashboard'},
  {avatar: '300-20.jpg', name: 'Brian Cox', to: '/account/overview'},
]

const teams: Team[] = TEAMS.map((t) => ({avatar: t.avatar, name: t.name}))
const defaultTeamIndex = Math.max(0, TEAMS.findIndex((t) => t.active))

const Sidebar = () => {
  const {config} = useLayout()

  useEffect(() => {
    updateDOM(config)
    // Cablea KTMenu para el menu Apps del sidebar movil (data-kt-menu) y re-inicializa drawers.
    reInitMenu()
  }, [config])

  if (!config.app?.sidebar?.display) {
    return null
  }

  return (
    <div
      id='kt_app_sidebar'
      className='app-sidebar flex-column'
      data-kt-drawer='true'
      data-kt-drawer-name='app-sidebar'
      data-kt-drawer-activate='{default: true, lg: false}'
      data-kt-drawer-overlay='true'
      data-kt-drawer-width='280px'
      data-kt-drawer-direction='start'
      data-kt-drawer-toggle='#kt_app_sidebar_mobile_toggle'
    >
      {/* begin::Sidebar navbar */}
      <div
        className='app-sidebar-navbar flex-grow-1 hover-scroll-overlay-y'
        id='kt_app_sidebar_primary_navbar'
        data-kt-scroll='true'
        data-kt-scroll-height='auto'
        data-kt-scroll-dependencies='#kt_app_header'
        data-kt-scroll-wrappers='#kt_app_sidebar'
        data-kt-scroll-offset='5px'
      >
        {/* ===================== DESKTOP: rail de caritas (70px) ===================== */}
        <div className='app-navbar flex-column flex-center py-4 d-none d-lg-flex'>
          {/* 5 recientes (selector) + boton de busqueda con popover a la derecha */}
          <DesktopTeamRail teams={teams} defaultIndex={defaultTeamIndex} />

          {/* begin::Separator */}
          <div className='separator mb-4 border-gray-300 mx-5'></div>
          {/* end::Separator */}

          {/* begin::Navbar item */}
          <div className='app-navbar-item flex-center'>
            <Link
              to='/account/overview'
              className='btn btn-icon btn-color-gray-600 bg-gray-200 btn-active-primary w-40px h-40px btn-accent'
            >
              <i className='ki-duotone ki-plus fs-1'></i>
            </Link>
          </div>
          {/* end::Navbar item */}
        </div>
        {/* ===================== end DESKTOP rail ===================== */}

        {/* ===================== MOVIL: selector Thunder + menu Apps ===================== */}
        <div className='d-flex d-lg-none flex-column w-100 p-4'>
          {/* Selector Thunder de caritas */}
          <MobileTeamSelector teams={teams} defaultIndex={defaultTeamIndex} />

          <div className='separator my-4'></div>

          {/* Menu Apps (reusa HEADER_MENU_HTML) en vertical/acordeon. id distinto del header. */}
          <div
            id='kt_app_sidebar_menu'
            className='menu menu-column menu-rounded menu-sub-indention menu-active-bg menu-state-primary menu-title-gray-800 menu-icon-gray-500 menu-arrow-gray-500 menu-bullet-gray-500 fw-semibold'
            data-kt-menu='true'
            dangerouslySetInnerHTML={{__html: withBase(HEADER_MENU_HTML)}}
          />
        </div>
        {/* ===================== end MOVIL ===================== */}
      </div>
      {/* end::Sidebar navbar */}

      {/* Upgrade al FONDO del drawer, solo en pantallas muy chicas (<sm): libera espacio en el
          navbar del header para que el menú de usuario no se salga. Abre el modal vía la
          delegación de HeaderWrapper (data-bs-toggle). Oculto en ≥sm (y en desktop). */}
      <div className='d-sm-none p-4 pt-2'>
        <a
          href='#'
          className='btn btn-primary w-100'
          data-bs-toggle='modal'
          data-bs-target='#kt_modal_upgrade_plan'
        >
          Upgrade Plan
        </a>
      </div>
    </div>
  )
}

const updateDOM = (config: ILayout) => {
  if (!config.app?.sidebar?.display) {
    return
  }

  document.body.setAttribute('data-kt-app-sidebar-enabled', 'true')
  document.body.setAttribute(
    'data-kt-app-sidebar-fixed',
    config.app?.sidebar?.default?.fixed?.desktop?.toString() || 'true'
  )

  if (config.app?.sidebar?.default?.push?.header) {
    document.body.setAttribute('data-kt-app-sidebar-push-header', 'true')
  }

  if (config.app?.sidebar?.default?.push?.toolbar) {
    document.body.setAttribute('data-kt-app-sidebar-push-toolbar', 'true')
  }

  if (config.app?.sidebar?.default?.push?.footer) {
    document.body.setAttribute('data-kt-app-sidebar-push-footer', 'true')
  }
}

export {Sidebar}
