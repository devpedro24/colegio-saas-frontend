/* eslint-disable no-prototype-builtins */
import {useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {Link} from 'react-router-dom'
import {ILayout, useLayout} from '../../core'
import {reInitMenu, withBase} from '../../../helpers'
import {getHeaderMenuHtml} from '../header/_HeaderMenuContent'
import {MobileTeamSelector, RailItem} from './MobileTeamSelector'
import {DesktopTeamRail} from './DesktopTeamRail'
import {useAuth} from '../../../../app/modules/auth'
import {useToast} from '@/lib/ui/toast'
import {useColegios} from '@/app/pages/config/colegios/colegios.api'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {useEnterColegio, useExitColegio} from '@/app/modules/impersonation/impersonation.api'
import {useSedes} from '@/app/pages/academico/estructura/estructura.api'

type AvatarItem = {
  avatar: string
  name: string
  active?: boolean
}

// Caritas placeholder demo. SOLO se usan para un usuario que NO es superadmin (no impersona):
// mantienen el look demo46 con avatares fijos + MRU. Para el superadmin, el rail se arma con
// colegios reales (ver PlatformDesktopRail / PlatformMobileSelector).
const TEAMS: AvatarItem[] = [
  {avatar: '300-2.jpg', name: 'Karina Clark'},
  {avatar: '300-7.jpg', name: 'Olivia Bold', active: true},
  {avatar: '300-10.jpg', name: 'Ana Clark'},
  {avatar: '300-1.jpg', name: 'Nick Logan'},
  {avatar: '300-3.jpg', name: 'Kevin Leonard'},
  {avatar: '300-21.jpg', name: 'Robert Doe'},
  {avatar: '300-6.jpg', name: 'Emma Bold'},
  {avatar: '300-13.jpg', name: 'Sean Bean'},
  {avatar: '300-20.jpg', name: 'Brian Cox'},
]

const DEMO_ITEMS: RailItem[] = TEAMS.map((t, i) => ({id: String(i), name: t.name, avatar: t.avatar}))
const DEMO_DEFAULT_ID = String(Math.max(0, TEAMS.findIndex((t) => t.active)))

// id sintético de la carita FIJA "Plataforma" (modo superadmin, sin colegio activo).
const PLATFORM_ID = '__platform__'

/**
 * Wiring del rail para el SUPERADMIN: carita fija "Plataforma" + colegios reales (MRU).
 * - activeId = colegio activo (suplantación) o "Plataforma" cuando no hay colegio activo.
 * - Seleccionar "Plataforma" -> useExitColegio() + clear() (modo plataforma).
 * - Seleccionar un colegio  -> useEnterColegio() -> setActive({colegio, token}) (modo colegio).
 * Se llama SÓLO dentro de componentes que se montan cuando isPlatform, así useColegios (endpoint
 * de plataforma) nunca se dispara para un usuario de colegio.
 */
function usePlatformTeams() {
  const intl = useIntl()
  const toast = useToast()
  const {activeColegio, setActive, clear} = useImpersonation()
  const {data: colegios} = useColegios()
  const enter = useEnterColegio()
  const exit = useExitColegio()

  const items = useMemo<RailItem[]>(() => {
    const platform: RailItem = {
      id: PLATFORM_ID,
      name: intl.formatMessage({id: 'impersonation.platform', defaultMessage: 'Plataforma'}),
      initial: 'P',
      isPlatform: true,
    }
    const schools: RailItem[] = (colegios ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      initial: c.name.charAt(0).toUpperCase(),
    }))
    return [platform, ...schools]
  }, [colegios, intl])

  const activeId = activeColegio ? activeColegio.id : PLATFORM_ID

  const onSelect = (item: RailItem) => {
    // "Plataforma": salir de la suplantación (si la hay) y volver a modo plataforma.
    if (item.isPlatform) {
      const current = activeColegio?.id
      if (current) {
        exit.mutate(current, {
          onError: () =>
            toast.error(
              intl.formatMessage({
                id: 'impersonation.exit.error',
                defaultMessage: 'No se pudo cerrar la sesión de administración en el servidor.',
              }),
            ),
        })
      }
      clear()
      return
    }
    // Ya estoy administrando ese colegio: no hago nada.
    if (item.id === activeColegio?.id) return
    // Entrar a administrar el colegio (suplantación).
    enter.mutate(item.id, {
      onSuccess: (res) => {
        setActive(res.data.colegio, res.data.token)
        toast.success(
          intl.formatMessage(
            {id: 'impersonation.enter.success', defaultMessage: 'Ahora administras {colegio}.'},
            {colegio: res.data.colegio.name},
          ),
        )
      },
      onError: () =>
        toast.error(
          intl.formatMessage({
            id: 'impersonation.enter.error',
            defaultMessage: 'No se pudo entrar al colegio.',
          }),
        ),
    })
  }

  return {items, activeId, onSelect}
}

const PlatformDesktopRail = () => {
  const {items, activeId, onSelect} = usePlatformTeams()
  return <DesktopTeamRail items={items} activeId={activeId} onSelect={onSelect} />
}

const PlatformMobileSelector = () => {
  const {items, activeId, onSelect} = usePlatformTeams()
  return <MobileTeamSelector items={items} activeId={activeId} onSelect={onSelect} />
}

// Rail demo (usuario NO superadmin): selección local, sólo estética.
const DemoDesktopRail = () => {
  const [activeId, setActiveId] = useState(DEMO_DEFAULT_ID)
  return <DesktopTeamRail items={DEMO_ITEMS} activeId={activeId} onSelect={(it) => setActiveId(it.id)} />
}

const DemoMobileSelector = () => {
  const [activeId, setActiveId] = useState(DEMO_DEFAULT_ID)
  return (
    <MobileTeamSelector items={DEMO_ITEMS} activeId={activeId} onSelect={(it) => setActiveId(it.id)} />
  )
}

const Sidebar = () => {
  const {config} = useLayout()
  const intl = useIntl()
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()

  const isPlatform = currentUser?.is_platform === true
  const isTenantUser = !!currentUser && currentUser.is_platform !== true
  const colegioMode = isTenantUser || (isPlatform && !!activeColegio)

  // Sedes del colegio activo para el submenú 'Sedes' del menú móvil (solo en modo colegio).
  const {data: sedes} = useSedes(colegioMode)

  useEffect(() => {
    updateDOM(config)
    // Cablea KTMenu para el menu Apps del sidebar movil (data-kt-menu) y re-inicializa drawers.
    reInitMenu()
  }, [config])

  // Re-inicializa el menú móvil cuando cambia el MODO (plataforma <-> colegio), porque el HTML
  // inyectado (secciones visibles) cambia y KTMenu debe recablearse sobre el nuevo árbol.
  useEffect(() => {
    reInitMenu()
  }, [activeColegio, isPlatform, isTenantUser, sedes])

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
          {/* Superadmin: Plataforma + colegios reales (MRU). Resto: rail demo. */}
          {isPlatform ? <PlatformDesktopRail /> : <DemoDesktopRail />}

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
          {/* Selector de caritas */}
          {isPlatform ? <PlatformMobileSelector /> : <DemoMobileSelector />}

          <div className='separator my-4'></div>

          {/* Menu Apps (reusa HEADER_MENU_HTML) en vertical/acordeon. id distinto del header. */}
          <div
            id='kt_app_sidebar_menu'
            className='menu menu-column menu-rounded menu-sub-indention menu-active-bg menu-state-primary menu-title-gray-800 menu-icon-gray-500 menu-arrow-gray-500 menu-bullet-gray-500 fw-semibold'
            data-kt-menu='true'
            dangerouslySetInnerHTML={{
              __html: withBase(
                getHeaderMenuHtml(intl, {
                  isPlatform,
                  isTenantUser,
                  activeColegio: !!activeColegio,
                  sedes: sedes?.map((s) => ({id: String(s.id), nombre: s.nombre})) ?? [],
                })
              ),
            }}
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
