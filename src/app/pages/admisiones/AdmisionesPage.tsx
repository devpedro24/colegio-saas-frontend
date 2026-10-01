import {Route, Routes, Navigate} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {Content} from '@/_metronic/layout/components/content'
import {PageTitle} from '@/_metronic/layout/core'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {CatalogoView} from '../academico/evaluacion/components/CatalogoView'

export default function AdmisionesPage() {
  const intl = useIntl()
  const {hasPermission} = useAuthz()
  if (!hasPermission('academico.matriculas.gestionar')) return <Navigate to='/dashboard' replace />
  return <Content><PageTitle>{intl.formatMessage({id: 'admisiones.title'})}</PageTitle>
    <Routes>
      <Route path='matriculas' element={<CatalogoView key='matriculas' enrollmentsOnly />} />
      <Route index element={<Navigate to='matriculas' replace />} />
    </Routes>
  </Content>
}
