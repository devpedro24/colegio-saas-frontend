import {PageTitle} from '@/_metronic/layout/core'
import {Content} from '@/_metronic/layout/components/content'
import {useIntl} from 'react-intl'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {AttendanceSheetView} from './AttendanceSheetView'
import {AttendanceRequestInbox, StudentJustifications} from './AttendanceRequests'

export default function AsistenciaPage() {
  const intl = useIntl()
  const {hasPermission, hasRole, isPlatform} = useAuthz()
  const canRecord = hasPermission('asistencia.registrar_clases') ||
    (hasPermission('asistencia.consultar_grupo') &&
      (hasRole('rector') || hasRole('coord_academico') || hasRole('coord_combinado') || isPlatform))
  const canRequest = hasPermission('asistencia.correccion.solicitar') &&
    ['docente', 'director_grupo', 'rector', 'coord_academico', 'coord_combinado'].some(role => hasRole(role))
  const canApprove = hasPermission('asistencia.correccion.aprobar') &&
    ['rector', 'secretaria', 'coord_academico', 'coord_combinado'].some(role => hasRole(role))
  const canStudent = hasRole('estudiante') && hasPermission('asistencia.justificar_propia')
  const canConfigure = hasPermission('asistencia.configurar_politica') &&
    (hasRole('rector') || hasRole('coord_academico') || hasRole('coord_combinado') || isPlatform)

  return <><PageTitle>{intl.formatMessage({id: 'attendance.title'})}</PageTitle><Content>
    {canRecord && <AttendanceSheetView canConfigure={canConfigure} canRequest={canRequest} />}
    {canStudent && <><StudentJustifications /><AttendanceRequestInbox scope='propias' /></>}
    {canRequest && <AttendanceRequestInbox scope='docente' />}
    {canApprove && <AttendanceRequestInbox scope='aprobacion' />}
  </Content></>
}
