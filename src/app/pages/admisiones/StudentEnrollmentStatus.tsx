import {useIntl} from 'react-intl'
import {useQuery} from '@tanstack/react-query'
import {useAuth} from '@/app/modules/auth'
import {api} from '@/lib/api/client'

export function StudentEnrollmentStatus() {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const {currentUser} = useAuth()
  const student = currentUser?.roles?.includes('estudiante')
  const query = useQuery({queryKey: ['ingreso', currentUser?.tenant_channel, 'mi-estado'], enabled: !!student,
    queryFn: () => api.get<{grupo_pendiente: boolean}>('/ingreso/mi-estado'), staleTime: 60000})
  if (!query.data?.grupo_pendiente) return null
  return <div className='alert alert-info' role='status'><strong>{t('intake.ui.groupAssignmentPending')}</strong> {' '}{t('intake.ui.yourApplicationWasApprovedTheSchoolWillEmailYouWhenItConfirms')}</div>
}
