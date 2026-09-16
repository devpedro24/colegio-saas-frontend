import {lazy, FC, Suspense} from 'react'
import {Route, Routes, Navigate} from 'react-router-dom'
import {MasterLayout} from '../../_metronic/layout/MasterLayout'
import TopBarProgress from 'react-topbar-progress-indicator'
import {DashboardWrapper} from '../pages/dashboard/DashboardWrapper'
import {getCSSVariableValue} from '../../_metronic/assets/ts/_utils'
import {WithChildren} from '../../_metronic/helpers'
import {RequireAccess} from './RequireAccess'

const PrivateRoutes = () => {
  const AccountPage = lazy(() => import('../modules/accounts/AccountPage'))
  const ConfigPage = lazy(() => import('../pages/config/ConfigPage'))
  const AcademicoPage = lazy(() => import('../pages/academico/AcademicoPage'))
  const UsuariosPage = lazy(() => import('../pages/usuarios/UsuariosPage'))

  return (
    <Routes>
      <Route element={<MasterLayout />}>
        {/* Redirect to Dashboard after success login/registartion */}
        <Route path='auth/*' element={<Navigate to='/dashboard' />} />
        {/* Pages */}
        <Route path='dashboard' element={<RequireAccess enforceMfa><DashboardWrapper /></RequireAccess>} />
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
              <RequireAccess platformOnly enforceMfa><ConfigPage /></RequireAccess>
            </SuspensedView>
          }
        />
        <Route
          path='academico/*'
          element={
            <SuspensedView>
              <RequireAccess tenantOnly enforceMfa><AcademicoPage /></RequireAccess>
            </SuspensedView>
          }
        />
        <Route
          path='usuarios'
          element={
            <SuspensedView>
              <RequireAccess tenantOnly permission='usuarios.gestionar' enforceMfa>
                <UsuariosPage />
              </RequireAccess>
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
