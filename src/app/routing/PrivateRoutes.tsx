import {lazy, FC, Suspense} from 'react'
import {Route, Routes, Navigate} from 'react-router-dom'
import {MasterLayout} from '../../_metronic/layout/MasterLayout'
import TopBarProgress from 'react-topbar-progress-indicator'
import {DashboardWrapper} from '../pages/dashboard/DashboardWrapper'
import {getCSSVariableValue} from '../../_metronic/assets/ts/_utils'
import {WithChildren} from '../../_metronic/helpers'

const PrivateRoutes = () => {
  const AccountPage = lazy(() => import('../modules/accounts/AccountPage'))
  const ConfigPage = lazy(() => import('../pages/config/ConfigPage'))
  const AcademicoPage = lazy(() => import('../pages/academico/AcademicoPage'))
  const UsuariosPage = lazy(() => import('../pages/usuarios/UsuariosPage'))
  const ProximamentePage = lazy(() => import('../pages/proximamente/ProximamentePage'))

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
              <ProximamentePage titleId='admisiones.title' defaultTitle='Admisiones y matrícula' />
            </SuspensedView>
          }
        />
        <Route
          path='evaluacion'
          element={
            <SuspensedView>
              <ProximamentePage titleId='evaluacion.title' defaultTitle='Evaluación y convivencia' />
            </SuspensedView>
          }
        />
        <Route
          path='comunicacion'
          element={
            <SuspensedView>
              <ProximamentePage titleId='comunicacion.title' defaultTitle='Comunicación' />
            </SuspensedView>
          }
        />
        <Route
          path='pagos'
          element={
            <SuspensedView>
              <ProximamentePage titleId='pagos.title' defaultTitle='Pagos' />
            </SuspensedView>
          }
        />
        <Route
          path='reportes'
          element={
            <SuspensedView>
              <ProximamentePage titleId='reportes.title' defaultTitle='Reportes' />
            </SuspensedView>
          }
        />
        <Route
          path='bienestar'
          element={
            <SuspensedView>
              <ProximamentePage titleId='bienestar.title' defaultTitle='Bienestar y servicios' />
            </SuspensedView>
          }
        />
        <Route
          path='talento-humano'
          element={
            <SuspensedView>
              <ProximamentePage titleId='talentoHumano.title' defaultTitle='Talento humano' />
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

export {PrivateRoutes}
