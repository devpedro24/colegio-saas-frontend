import { Route, Routes, Navigate } from 'react-router';
import { DashboardLayout } from '@/components/layouts/dashboard';
import { DashboardPage } from '@/pages/dashboard/page';

export function AppRoutingSetup() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
      {/* La raiz y cualquier ruta desconocida llevan al dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
