import {FC} from 'react'
import {Navigate, Route, Routes} from 'react-router-dom'
import ColegiosPage from './colegios/ColegiosPage'
import PlanesPage from './planes/PlanesPage'
import RbacPage from './rbac/RbacPage'

// Router anidado del modulo Configuracion. Cada pagina ya trae su propio
// <PageTitle> + <Content>, por eso aqui NO se envuelve con ToolbarWrapper/Content.
const ConfigPage: FC = () => {
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
