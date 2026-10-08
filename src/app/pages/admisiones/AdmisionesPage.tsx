import {Route, Routes, Navigate, useLocation} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {Content} from '@/_metronic/layout/components/content'
import {PageTitle} from '@/_metronic/layout/core'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {CatalogoView} from '../academico/evaluacion/components/CatalogoView'
import EnrollmentManagement from './EnrollmentManagement'
import {AcademicPageHeader} from '@/app/shared/components/AcademicPageHeader'

export default function AdmisionesPage() {
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const intl = useIntl()
  const {pathname} = useLocation()
  const {hasPermission} = useAuthz()
  const intake = ['ingreso.ver', 'ingreso.configurar', 'ingreso.revisar', 'ingreso.decidir', 'ingreso.asignar'].some(hasPermission)
  if (!hasPermission('academico.matriculas.gestionar') && !intake) return <Navigate to='/dashboard' replace />
  const title = pathname.endsWith('/matriculas') ? intl.formatMessage({id: 'admisiones.title'}) : pathname.endsWith('/seleccion') ? t('intake.ui.admissions') : t('intake.ui.enrollmentByLink')
  return <Content><PageTitle>{title}</PageTitle>
    <Routes>
      <Route path='solicitudes' element={intake ? <EnrollmentManagement /> : <Navigate to='../matriculas' replace />} />
      <Route path='matriculas' element={hasPermission('academico.matriculas.gestionar') ? <CatalogoView key='matriculas' enrollmentsOnly /> : <Navigate to='../solicitudes' replace />} />
      <Route path='seleccion' element={<AcademicPageHeader title={t('intake.ui.admissions')} description={t('intake.ui.preselectionInterviewsAndTestsComingSoonCurrentRoundsAllowDirectEnrollmentApplications')} />} />
      <Route index element={<Navigate to={intake ? 'solicitudes' : 'matriculas'} replace />} />
    </Routes>
  </Content>
}
