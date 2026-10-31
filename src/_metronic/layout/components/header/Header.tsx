import {FC, useEffect} from 'react'
import {useIntl} from 'react-intl'
import {ILayout, useLayout} from '../../core'
import {reInitMenu, withBase} from '../../../helpers'
import {getHeaderMenuHtml} from './_HeaderMenuContent'
import {useAuth} from '../../../../app/modules/auth'
import {useAuthz} from '../../../../app/modules/auth/core/authz'
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
  const {hasPermission, hasRole, hasFeature} = useAuthz()
  const {activeColegio} = useImpersonation()

  const isPlatform = currentUser?.is_platform === true
  const isTenantUser = !!currentUser && currentUser.is_platform !== true
  const canManageUsers = hasPermission('usuarios.gestionar') || hasPermission('estudiantes.egreso.gestionar')

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
            canViewAttendance: hasPermission('asistencia.registrar_clases') ||
              hasPermission('asistencia.justificar_propia') || hasPermission('asistencia.correccion.aprobar') ||
              hasPermission('asistencia.correccion.solicitar') ||
              (hasPermission('asistencia.consultar_grupo') &&
                (hasRole('rector') || hasRole('coord_academico') || hasRole('coord_combinado') || isPlatform)),
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
