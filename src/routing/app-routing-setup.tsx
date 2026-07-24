import { Route, Routes, Navigate } from 'react-router';
import { DashboardLayout } from '@/components/layouts/dashboard';
import { DashboardPage } from '@/pages/dashboard/page';
import { LoginPage } from '@/features/auth/login-page';
import { RequireAuth } from '@/features/auth/require-auth';
import { RolesPermissionsPage } from '@/features/rbac/roles-permissions-page';
import { ColegiosPage } from '@/features/colegios/colegios-page';
import { PlanesPage } from '@/features/planes/planes-page';
import { RbacAdminPage } from '@/features/rbac-admin/rbac-admin-page';

export function AppRoutingSetup() {
  return (
    <Routes>
      {/* Publica */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protegidas: requieren sesion. El layout (con Outlet) envuelve las paginas. */}
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Panel del superadministrador (solo plataforma) */}
        <Route
          path="/plataforma/colegios"
          element={
            <RequireAuth platform>
              <ColegiosPage />
            </RequireAuth>
          }
        />
        <Route
          path="/plataforma/planes"
          element={
            <RequireAuth platform>
              <PlanesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/plataforma/roles-permisos"
          element={
            <RequireAuth platform>
              <RbacAdminPage />
            </RequireAuth>
          }
        />

        {/* Configuracion del colegio (rector) */}
        <Route
          path="/configuracion/roles"
          element={
            <RequireAuth permission="usuarios.ajustar_permisos">
              <RolesPermissionsPage />
            </RequireAuth>
          }
        />
      </Route>

      {/* La raiz y cualquier ruta desconocida llevan al dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
