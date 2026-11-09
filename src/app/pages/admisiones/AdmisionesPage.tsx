import {Route, Routes, Navigate} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {Content} from '@/_metronic/layout/components/content'
import {PageTitle} from '@/_metronic/layout/core'
import {useAuthz} from '@/app/modules/auth/core/authz'
import EnrollmentManagement from './EnrollmentManagement'
import CampaignPage from './CampaignPage'

export default function AdmisionesPage() {
  const intl = useIntl(), {hasPermission} = useAuthz()
  const read = hasPermission('ingreso.ver'), configure = hasPermission('ingreso.configurar')
  const intake = ['ingreso.ver', 'ingreso.configurar', 'ingreso.revisar', 'ingreso.decidir', 'ingreso.asignar'].some(hasPermission)
  const enrolled = hasPermission('academico.matriculas.gestionar')
  if (!intake && !enrolled) return <Navigate to='/dashboard' replace />
  const home = read ? '/admisiones/solicitudes' : intake ? '/admisiones/convocatorias' : '/admisiones/matriculas'
  const fallback = <Navigate to={home} replace />
  return <Content><PageTitle>{intl.formatMessage({id: 'intake.flow.managementTitle'})}</PageTitle>
    <Routes>
      <Route path='solicitudes' element={read ? <EnrollmentManagement /> : fallback} />
      <Route path='pines' element={read ? <EnrollmentManagement section='pins' /> : fallback} />
      <Route path='convocatorias' element={intake ? <EnrollmentManagement section='campaigns' /> : fallback} />
      <Route path='convocatorias/nueva' element={configure ? <CampaignPage /> : fallback} />
      <Route path='convocatorias/:token/editar' element={configure ? <CampaignPage /> : fallback} />
      <Route path='convocatorias/:token/reutilizar' element={configure ? <CampaignPage /> : fallback} />
      <Route path='matriculas' element={enrolled ? <EnrollmentManagement section='enrolled' /> : fallback} />
      <Route path='notificaciones' element={read ? <EnrollmentManagement section='notifications' /> : fallback} />
      <Route path='*' element={fallback} />
    </Routes>
  </Content>
}
