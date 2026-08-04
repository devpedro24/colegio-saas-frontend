import {FC} from 'react'
import {Navigate, Route, Routes} from 'react-router-dom'
import {useAuthz} from '../../modules/auth/core/authz'
import {useImpersonation} from '../../modules/impersonation/impersonation.store'
import AnosLectivosPage from './anos-lectivos/AnosLectivosPage'
import ConfiguracionColegioPage from './configuracion/ConfiguracionColegioPage'
import EstructuraPage from './estructura/EstructuraPage'
import SedeDetallePage from './sedes/SedeDetallePage'
import UsuariosPage from './usuarios/UsuariosPage'

// Router anidado del modulo Academico. Cada pagina trae su propio <PageTitle> +
// <Content>, por eso aqui NO se envuelve con ToolbarWrapper/Content.
const AcademicoPage: FC = () => {
  const {isPlatform} = useAuthz()
  const {activeColegio} = useImpersonation()

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
      <Route path='configuracion' element={<ConfiguracionColegioPage />} />
      <Route path='usuarios' element={<UsuariosPage />} />
      <Route path='sedes/:id' element={<SedeDetallePage />} />
      <Route index element={<Navigate to='/academico/anos-lectivos' />} />
    </Routes>
  )
}

export default AcademicoPage
