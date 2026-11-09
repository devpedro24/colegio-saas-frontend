import {useEffect, useMemo, useRef} from 'react'
import {useIntl} from 'react-intl'
import {Link, useLocation} from 'react-router-dom'
import {ILayout, useLayout} from '../../core'
import {reInitMenu, withBase} from '../../../helpers'
import {getHeaderMenuHtml} from '../header/_HeaderMenuContent'
import {MobileTeamSelector, RailItem} from './MobileTeamSelector'
import {DesktopTeamRail} from './DesktopTeamRail'
import {useAuth} from '../../../../app/modules/auth'
import {useAuthz} from '../../../../app/modules/auth/core/authz'
import {useToast} from '@/lib/ui/toast'
import {useColegios} from '@/app/pages/config/colegios/colegios.api'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {useEnterColegio, useExitColegio} from '@/app/modules/impersonation/impersonation.api'
import {useSedes, sedeSubdomainUrl} from '@/app/pages/academico/estructura/estructura.api'
import {DrawerComponent} from '../../../assets/ts/components'
import {syncSidebarRoute} from './sidebarNavigation'

// id sintético de la carita FIJA "Plataforma" (modo superadmin, sin colegio activo).
const PLATFORM_ID = '__platform__'

/**
 * Wiring del rail para el SUPERADMIN: carita fija "Plataforma" + colegios reales (MRU).
 * - activeId = colegio activo (suplantación) o "Plataforma" cuando no hay colegio activo.
 * - Seleccionar "Plataforma" -> useExitColegio() + clear() (modo plataforma).
 * - Seleccionar un colegio  -> useEnterColegio() -> setActive(colegio) (modo colegio).
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
      name: intl.formatMessage({id: 'impersonation.platform'}),
      initial: 'P',
      isPlatform: true,
    }
    const schools: RailItem[] = (colegios?.data ?? []).map((c) => ({
      id: c.slug,
      name: c.name,
      initial: c.name.charAt(0).toUpperCase(),
    }))
    return [platform, ...schools]
  }, [colegios, intl])

  const activeId = activeColegio ? activeColegio.slug : PLATFORM_ID

  const onSelect = (item: RailItem) => {
    // "Plataforma": salir de la suplantación (si la hay) y volver a modo plataforma.
    if (item.isPlatform) {
      if (activeColegio) {
        exit.mutate(undefined, {
          onSuccess: () => {clear(); window.location.href = '/dashboard'},
          onError: () =>
            toast.error(
              intl.formatMessage({
                id: 'impersonation.exit.error',
              }),
            ),
        })
      }
      else window.location.href = '/dashboard'
      return
    }
    // Ya estoy administrando ese colegio: no hago nada.
    if (item.id === activeColegio?.slug) return
    // Entrar a administrar el colegio (suplantación).
    enter.mutate(item.id, {
      onSuccess: (res) => {
        setActive(res.data.colegio)
        toast.success(
          intl.formatMessage(
            {id: 'impersonation.enter.success'},
            {colegio: res.data.colegio.name},
          ),
        )
        window.location.href = '/dashboard'
      },
      onError: () =>
        toast.error(
          intl.formatMessage({
            id: 'impersonation.enter.error',
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

/**
 * Wiring del rail para un usuario de COLEGIO (rector/coordinador): las sedes del colegio.
 * - activeId = sede principal (el colegio donde se está logueado).
 * - Seleccionar una sede adicional navega a su subdominio (`window.location.assign`).
 * - La sede principal no navega: es el contexto actual.
 */
function useSedeTeams() {
  const {data: sedes} = useSedes(true)

  const items = useMemo<RailItem[]>(
    () =>
      (sedes?.data ?? []).map((s) => ({
        id: String(s.id),
        name: s.nombre,
        initial: s.nombre.charAt(0).toUpperCase(),
      })),
    [sedes],
  )

  const principal = useMemo(
    () => (sedes?.data ?? []).find((s) => !s.tenant_id) ?? (sedes?.data ?? [])[0],
    [sedes],
  )

  // La rail solo tiene sentido si hay sedes adicionales navegables.
  const adicionales = (sedes?.data ?? []).filter((s) => !!s.tenant_id && s.tenant_domain).length

  const activeId = principal ? String(principal.id) : items[0]?.id ?? ''

  const onSelect = (item: RailItem) => {
    const sede = (sedes?.data ?? []).find((s) => String(s.id) === item.id)
    // Sede principal (colegio actual): no se navega.
    if (!sede || !sede.tenant_id || !sede.tenant_domain) return
    window.open(sedeSubdomainUrl(sede.tenant_domain), '_blank', 'noopener,noreferrer')
  }

  return {items, activeId, onSelect, adicionales}
}

const SedeDesktopRail = () => {
  const {items, activeId, onSelect, adicionales} = useSedeTeams()
  if (adicionales === 0) return null
  return (
    <DesktopTeamRail
      items={items}
      activeId={activeId}
      onSelect={onSelect}
      searchTitle='Buscar sede'
      searchPlaceholder='Buscar sede...'
    />
  )
}

const SedeMobileSelector = () => {
  const {items, activeId, onSelect, adicionales} = useSedeTeams()
  if (adicionales === 0) return null
  return (
    <MobileTeamSelector
      items={items}
      activeId={activeId}
      onSelect={onSelect}
      searchPlaceholder='Buscar sede...'
    />
  )
}

const Sidebar = () => {
  const {pathname} = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)
  const {config} = useLayout()
  const intl = useIntl()
  const {currentUser} = useAuth()
  const {hasPermission, hasRole, hasFeature} = useAuthz()
  const {activeColegio} = useImpersonation()
  const isPlatform = currentUser?.is_platform === true
  const isTenantUser = !!currentUser && currentUser.is_platform !== true
  const {data: sedesForRail, isLoading: sedesLoading} = useSedes(!!currentUser &&
    (isPlatform ? !!activeColegio : hasPermission('academico.estructura.gestionar')))
  const canManageUsers = hasPermission('usuarios.gestionar') || hasPermission('estudiantes.egreso.gestionar')

  // La rail desktop solo se muestra si hay sedes adicionales navegables (no
  // principal) o si se está en modo plataforma pura (siempre tiene colegios).
  // Mientras cargan las sedes no ocultamos para evitar flicker.
  const sedesAdicionales = (sedesForRail?.data ?? []).filter((s) => !!s.tenant_id && s.tenant_domain).length
  const showDesktopBlock = (isPlatform && !activeColegio) || sedesAdicionales > 0
  const showSidebar = showDesktopBlock || sedesLoading

  useEffect(() => {
    if (showSidebar) {
      updateDOM(config)
    } else {
      // Sin sidebar visible: el app-main debe ocupar el 100% del ancho.
      document.body.removeAttribute('data-kt-app-sidebar-enabled')
      document.body.removeAttribute('data-kt-app-sidebar-fixed')
      document.body.removeAttribute('data-kt-app-sidebar-push-header')
      document.body.removeAttribute('data-kt-app-sidebar-push-toolbar')
      document.body.removeAttribute('data-kt-app-sidebar-push-footer')
    }
    // Cablea KTMenu para el menu Apps del sidebar movil (data-kt-menu) y re-inicializa drawers.
    reInitMenu()
  }, [config, showSidebar])

  // Re-inicializa el menú móvil cuando cambia el MODO (plataforma <-> colegio), porque el HTML
  // inyectado (secciones visibles) cambia y KTMenu debe recablearse sobre el nuevo árbol.
  useEffect(() => {
    reInitMenu()
  }, [activeColegio, isPlatform, isTenantUser])

  useEffect(() => {
    const selectCurrent = () => {
      if (menuRef.current) syncSidebarRoute(menuRef.current, pathname)
    }
    selectCurrent()
    DrawerComponent.getInstance('kt_app_sidebar')?.hide()
    // Opening the drawer restores the current route's parent, even if it was collapsed.
    const toggle = document.getElementById('kt_app_sidebar_mobile_toggle')
    toggle?.addEventListener('click', selectCurrent)
    return () => toggle?.removeEventListener('click', selectCurrent)
  }, [pathname, intl, activeColegio, currentUser])

  if (!config.app?.sidebar?.display) {
    return null
  }

  return (
    <div
      id='kt_app_sidebar'
      className={`app-sidebar flex-column${showSidebar ? '' : ' d-lg-none'}`}
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
        style={{minHeight: 0}}
        id='kt_app_sidebar_primary_navbar'
        data-kt-scroll='true'
        data-kt-scroll-height='auto'
        data-kt-scroll-dependencies='#kt_app_header'
        data-kt-scroll-wrappers='#kt_app_sidebar'
        data-kt-scroll-offset='5px'
      >
        {/* ===================== DESKTOP: rail de caritas (70px) ===================== */}
        {showDesktopBlock && (
          <div className='app-navbar flex-column flex-center py-4 d-none d-lg-flex'>
            {/* Superadmin: Plataforma + colegios reales (MRU). Resto: sedes del colegio. */}
            {(isPlatform && !activeColegio) ? <PlatformDesktopRail /> : <SedeDesktopRail />}

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
        )}
        {/* ===================== end DESKTOP rail ===================== */}

        {/* ===================== MOVIL: selector Thunder + menu Apps ===================== */}
        <div className='d-flex d-lg-none flex-column w-100 p-4'>
          {/* Selector de caritas */}
          {(isPlatform && !activeColegio) ? <PlatformMobileSelector /> : sedesAdicionales > 0 ? <SedeMobileSelector /> : null}

          <div className='separator my-4'></div>

          {/* Menu Apps (reusa HEADER_MENU_HTML) en vertical/acordeon. id distinto del header. */}
          <div
            id='kt_app_sidebar_menu'
            ref={menuRef}
            className='menu menu-column menu-rounded menu-sub-indention menu-active-bg menu-state-primary menu-title-gray-800 menu-icon-gray-500 menu-arrow-gray-500 menu-bullet-gray-500 fw-semibold'
            data-kt-menu='true'
            dangerouslySetInnerHTML={{
              __html: withBase(
                getHeaderMenuHtml(intl, {
                  isPlatform,
                  isTenantUser,
                  activeColegio: !!activeColegio,
                  canManageUsers,
                  canManageRbac: !isPlatform && hasRole('rector') && hasPermission('usuarios.ajustar_permisos'),
                  canViewPreinformes: hasFeature('preinformes') && (hasPermission('academico.preinformes.ver') || hasPermission('academico.preinformes.gestionar')),
                  canViewIndicators: hasPermission('indicadores.base.gestionar') || hasPermission('indicadores.grupo.ver'),
                  canManageYears: hasPermission('academico.anos.gestionar'),
                  canManageStructure: hasPermission('academico.estructura.gestionar'),
                  canManageStudyPlan: hasPermission('academico.plan_estudios.gestionar'),
                  canConfigureAcademics: hasPermission('academico.configurar'),
                  canViewGradebook: hasPermission('notas.ver_consolidado_todos') || hasPermission('notas.editar_no_dicta') || hasPermission('notas.registrar_materia_asignada'),
                  canViewBulletins: hasPermission('boletines.grupo.ver') || hasPermission('boletines.emisiones.ver') || hasPermission('notas.ver_propias'),
                  canViewPayments: hasFeature('pagos_pension') && hasPermission('pagos.ver'),
                  canViewFinancialReports: hasFeature('reportes_financieros') && hasPermission('reportes.financieros'),
                  canManageIntake: ['ingreso.ver', 'ingreso.configurar', 'ingreso.revisar', 'ingreso.decidir', 'ingreso.asignar'].some(hasPermission),
                  canManageEnrollments: hasPermission('academico.matriculas.gestionar'),
                  canViewAula: hasFeature('aula') && (hasPermission('aula.ver_todas') || hasPermission('aula.ver_asignadas') || hasPermission('aula.ver_propias')),
                  canViewAttendance: hasPermission('asistencia.registrar_clases') || hasPermission('asistencia.justificar_propia') ||
                    hasPermission('asistencia.correccion.aprobar') || hasPermission('asistencia.correccion.solicitar') ||
                    (hasPermission('asistencia.consultar_grupo') &&
                      (hasRole('rector') || hasRole('coord_academico') || hasRole('coord_combinado') || isPlatform)),
                })
              ),
            }}
          />
        </div>
        {/* ===================== end MOVIL ===================== */}
      </div>
      {/* end::Sidebar navbar */}

      {/* Shared upgrade modal; the mobile menu remains available without a campus rail. */}
      <div className='d-lg-none flex-shrink-0 p-4 pt-2 pb-5'>
        <button
          type='button'
          className='btn btn-primary w-100'
          data-bs-toggle='modal'
          data-bs-target='#kt_modal_upgrade_plan'
          onClick={() => DrawerComponent.getInstance('kt_app_sidebar')?.hide()}
        >
          {intl.formatMessage({id: 'header.navbar.upgrade'})}{' '}{intl.formatMessage({id: 'header.navbar.planWord'})}
        </button>
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
