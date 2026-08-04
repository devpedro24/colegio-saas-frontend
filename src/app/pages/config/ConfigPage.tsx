import {FC} from 'react'
import {Navigate, Route, Routes} from 'react-router-dom'
import {useAuthz} from '../../modules/auth/core/authz'
import ColegiosPage from './colegios/ColegiosPage'
import PlanesPage from './planes/PlanesPage'
import RbacPage from './rbac/RbacPage'

// Router anidado del modulo Configuracion. Cada pagina ya trae su propio
// <PageTitle> + <Content>, por eso aqui NO se envuelve con ToolbarWrapper/Content.
const ConfigPage: FC = () => {
  const {isPlatform} = useAuthz()

  // Gating de rutas: Configuracion es exclusiva de usuarios de PLATAFORMA.
  // Cualquier otro usuario que intente entrar es redirigido al dashboard.
  if (!isPlatform) {
    return <Navigate to='/dashboard' replace />
  }

  return (
    <Routes>
      <Route path='colegios' element={<ColegiosPage />} />
      <Route path='planes' element={<PlanesPage />} />
      <Route path='roles-permisos' element={<RbacPage />} />
      <Route index element={<Navigate to='/configuracion/colegios' />} />
    </Routes>
  )
}

export default ConfigPage
