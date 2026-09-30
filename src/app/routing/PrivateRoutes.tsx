import {lazy, FC, Suspense} from 'react'
import {Route, Routes, Navigate, useLocation} from 'react-router-dom'
import {MasterLayout} from '../../_metronic/layout/MasterLayout'
import TopBarProgress from 'react-topbar-progress-indicator'
import {DashboardWrapper} from '../pages/dashboard/DashboardWrapper'
import {getCSSVariableValue} from '../../_metronic/assets/ts/_utils'
import {WithChildren} from '../../_metronic/helpers'
import {useAuthz} from '../modules/auth/core/authz'
import {useImpersonation} from '../modules/impersonation/impersonation.store'

const AccountPage = lazy(() => import('../modules/accounts/AccountPage'))
const ConfigPage = lazy(() => import('../pages/config/ConfigPage'))
const AcademicoPage = lazy(() => import('../pages/academico/AcademicoPage'))
const InstitutionalSettingsPage = lazy(() => import('../pages/academico/configuracion/InstitutionalSettingsPage'))
const SedeDetallePage = lazy(() => import('../pages/academico/sedes/SedeDetallePage'))
const UsuariosPage = lazy(() => import('../pages/usuarios/UsuariosPage'))
const ProximamentePage = lazy(() => import('../pages/proximamente/ProximamentePage'))
const EventosPage = lazy(() => import('../pages/comunicacion/EventosPage'))

const PrivateRoutes = () => {
  return (
    <Routes>
      <Route element={<MasterLayout />}>
        {/* Redirect to Dashboard after success login/registartion */}
        <Route path='auth/*' element={<Navigate to='/dashboard' />} />
        {/* Pages */}
        <Route path='dashboard' element={<DashboardWrapper />} />
        {/* Lazy Modules */}
        <Route
          path='account/*'
          element={
            <SuspensedView>
              <AccountPage />
            </SuspensedView>
          }
        />
        <Route
          path='configuracion/*'
          element={
            <SuspensedView>
              <ConfigPage />
            </SuspensedView>
          }
        />
        <Route
          path='academico/*'
          element={
            <SuspensedView>
              <AcademicoPage />
            </SuspensedView>
          }
        />
        <Route path='ajustes-institucionales' element={<InstitutionalSettingsIndex />} />
        <Route
          path='ajustes-institucionales/datos'
          element={<SuspensedView><InstitutionalSettingsPage section='datos' /></SuspensedView>}
        />
        <Route
          path='ajustes-institucionales/sedes'
          element={<SuspensedView><InstitutionalSettingsPage section='sedes' /></SuspensedView>}
        />
        <Route path='ajustes-institucionales/sedes/:id' element={<InstitutionalSedeDetalleRoute />} />
        <Route
          path='usuarios'
          element={
            <SuspensedView>
              <UsuariosPage />
            </SuspensedView>
          }
        />
        {/* Módulos del roadmap aún sin pantallas reales (placeholder "próximamente") */}
        <Route
          path='admisiones'
          element={
            <SuspensedView>
              <ProximamentePage titleId='admisiones.title' />
            </SuspensedView>
          }
        />
        <Route
          path='evaluacion/*'
          element={
            <SuspensedView>
              <AcademicAlias />
            </SuspensedView>
          }
        />
        <Route
          path='boletines/*'
          element={
            <SuspensedView>
              <AcademicAlias />
            </SuspensedView>
          }
        />
        <Route
          path='siee/*'
          element={
            <SuspensedView>
              <AcademicAlias />
            </SuspensedView>
          }
        />
        <Route
          path='comunicacion/*'
          element={
            <SuspensedView>
              <EventosPage />
            </SuspensedView>
          }
        />
        <Route
          path='pagos'
          element={
            <SuspensedView>
              <ProximamentePage titleId='pagos.title' />
            </SuspensedView>
          }
        />
        <Route
          path='reportes'
          element={
            <SuspensedView>
              <ProximamentePage titleId='reportes.title' />
            </SuspensedView>
          }
        />
        <Route
          path='bienestar'
          element={
            <SuspensedView>
              <ProximamentePage titleId='bienestar.title' />
            </SuspensedView>
          }
        />
        <Route
          path='talento-humano'
          element={
            <SuspensedView>
              <ProximamentePage titleId='talentoHumano.title' />
            </SuspensedView>
          }
        />
        {/* Page Not Found */}
        <Route path='*' element={<Navigate to='/error/404' />} />
      </Route>
    </Routes>
  )
}

const SuspensedView: FC<WithChildren> = ({children}) => {
  const baseColor = getCSSVariableValue('--bs-primary')
  TopBarProgress.config({
    barColors: {
      '0': baseColor,
    },
    barThickness: 1,
    shadowBlur: 5,
  })
  return <Suspense fallback={<TopBarProgress />}>{children}</Suspense>
}

const AcademicAlias = () => {
  const {pathname, search} = useLocation()
  return <Navigate to={`/academico${pathname}${search}`} replace />
}

const InstitutionalSettingsIndex = () => {
  const {isPlatform, hasPermission} = useAuthz()
  const {activeColegio} = useImpersonation()
  const inSchool = !isPlatform || !!activeColegio
  const superadminInSchool = isPlatform && !!activeColegio

  if (inSchool && (superadminInSchool || hasPermission('academico.configurar'))) {
    return <Navigate to='/ajustes-institucionales/datos' replace />
  }
  if (inSchool && hasPermission('academico.estructura.gestionar')) {
    return <Navigate to='/ajustes-institucionales/sedes' replace />
  }
  return <Navigate to='/dashboard' replace />
}

const InstitutionalSedeDetalleRoute = () => {
  const {isPlatform, hasPermission} = useAuthz()
  const {activeColegio} = useImpersonation()
  const allowed = (isPlatform && !!activeColegio) ||
    (!isPlatform && hasPermission('academico.estructura.gestionar'))

  if (!allowed) return <Navigate to='/dashboard' replace />
  return <SuspensedView><SedeDetallePage /></SuspensedView>
}

export {PrivateRoutes}
