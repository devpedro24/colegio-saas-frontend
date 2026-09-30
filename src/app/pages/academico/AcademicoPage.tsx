import {FC} from 'react'
import {Navigate, Route, Routes, useLocation, useParams, useSearchParams} from 'react-router-dom'
import {useAuthz} from '../../modules/auth/core/authz'
import {useImpersonation} from '../../modules/impersonation/impersonation.store'
import AnosLectivosPage from './anos-lectivos/AnosLectivosPage'
import ConfiguracionColegioPage from './configuracion/ConfiguracionColegioPage'
import EstructuraPage from './estructura/EstructuraPage'
import PlanEstudiosPage from './plan-estudios/PlanEstudiosPage'
import EvaluacionPage from './evaluacion/EvaluacionPage'
import SieePage from './siee/SieePage'
import BoletinesPage from './boletines/BoletinesPage'

// Los enlaces previos siguen funcionando después de separar la configuración.
const LegacyConfiguracionRedirect: FC = () => {
  const [params] = useSearchParams()
  const tab = params.get('tab')
  if (tab === 'sedes') {
    return <Navigate to='/ajustes-institucionales/sedes' replace />
  }
  if (tab === 'escala' || tab === 'metodo' || tab === 'modelo') {
    return <Navigate to={`/academico/parametros-academicos?tab=${tab}`} replace />
  }
  return <Navigate to='/ajustes-institucionales/datos' replace />
}

const LegacySedeDetalleRedirect: FC = () => {
  const {id} = useParams<{id: string}>()
  const {search} = useLocation()
  return <Navigate to={`/ajustes-institucionales/sedes/${encodeURIComponent(id ?? '')}${search}`} replace />
}

// Router anidado del modulo Academico. Cada pagina trae su propio <PageTitle> +
// <Content>, por eso aqui NO se envuelve con ToolbarWrapper/Content.
const AcademicoPage: FC = () => {
  const {isPlatform, hasPermission} = useAuthz()
  const {activeColegio} = useImpersonation()
  const platformInSchool = isPlatform && !!activeColegio
  const canConfigure = platformInSchool || hasPermission('academico.configurar')
  const canManageCampuses = platformInSchool || hasPermission('academico.estructura.gestionar')

  // Gating de rutas: Academico es para usuarios de COLEGIO (tenant). El
  // superadministrador de plataforma SOLO accede si ha entrado a un colegio
  // (impersonacion activa = activeColegio); en modo Plataforma no gestiona academia.
  if (isPlatform && !activeColegio) {
    return <Navigate to='/dashboard' replace />
  }

  return (
    <Routes>
      <Route path='anos-lectivos' element={<AnosLectivosPage />} />
      <Route path='estructura' element={<EstructuraPage />} />
      <Route path='plan-estudios' element={<PlanEstudiosPage />} />
      <Route path='configuracion' element={<LegacyConfiguracionRedirect />} />
      <Route path='parametros-academicos' element={canConfigure ? <ConfiguracionColegioPage /> : <Navigate to='/dashboard' replace />} />
      <Route path='ajustes-institucionales' element={<Navigate to={canConfigure ? '/ajustes-institucionales/datos' : canManageCampuses ? '/ajustes-institucionales/sedes' : '/dashboard'} replace />} />
      <Route path='ajustes-institucionales/datos' element={<Navigate to='/ajustes-institucionales/datos' replace />} />
      <Route path='ajustes-institucionales/sedes' element={<Navigate to='/ajustes-institucionales/sedes' replace />} />
      <Route path='siee/*' element={<SieePage />} />
      <Route path='evaluacion/*' element={<EvaluacionPage />} />
      <Route path='boletines/*' element={<BoletinesPage />} />
      <Route path='sedes/:id' element={<LegacySedeDetalleRedirect />} />
      <Route index element={<Navigate to='/academico/anos-lectivos' />} />
    </Routes>
  )
}

export default AcademicoPage
