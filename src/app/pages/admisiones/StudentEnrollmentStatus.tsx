import {useIntl} from 'react-intl'
import {Link} from 'react-router-dom'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useAuth} from '@/app/modules/auth'
import {api} from '@/lib/api/client'
import {getEnrollmentStates} from './ingreso.types'

type Renewal = {
  token: string
  convocatoria: string
  ano: string
  ano_token: string
  estado: string
  grupo: string | null
  clases_habilitadas: boolean
}

export function StudentEnrollmentStatus() {
  const client = useQueryClient()
  const intl = useIntl()
  const spanish = intl.locale.startsWith('es')
  const {currentUser} = useAuth()
  const student = currentUser?.roles?.includes('estudiante')
  const query = useQuery({
    queryKey: ['ingreso', currentUser?.tenant_channel, currentUser?.id, 'mi-estado'],
    enabled: !!student,
    queryFn: () => api.get<{grupo_pendiente: boolean; tramites: Renewal[]}>('/ingreso/mi-estado'),
    refetchOnMount: 'always',
    refetchInterval: q => q.state.data?.tramites?.some(item => !item.clases_habilitadas && ['aprobada', 'matriculada'].includes(item.estado)) ? 30000 : false,
  })
  if (!student || !query.data?.tramites?.length) return null
  const states = getEnrollmentStates(intl)
  return <section className='card mb-6' aria-labelledby='my-enrollment'>
    <div className='card-body'>
      <h2 id='my-enrollment' className='h4 mb-4'>{spanish ? 'Mi matrícula' : 'My enrollment'}</h2>
      {query.data.tramites.map(item => <article key={item.token} className='d-flex flex-wrap align-items-center justify-content-between gap-3 py-3'>
        <div>
          <h3 className='fs-5 mb-1'>{item.convocatoria}</h3>
          <p className='text-gray-700 mb-1'>{item.ano}{item.grupo && ` · ${item.grupo}`}</p>
          <span className={item.clases_habilitadas ? 'badge badge-light-success' : 'badge badge-light-primary'}>
            {item.clases_habilitadas ? (spanish ? 'Clases habilitadas' : 'Classes available')
              : item.grupo ? (spanish ? 'Grupo confirmado · Clases pendientes de habilitación' : 'Group confirmed · Classes pending')
              : item.estado === 'aprobada' ? intl.formatMessage({id: 'intake.ui.groupAssignmentPending'}) : states[item.estado]}
          </span>
        </div>
        <div className='d-flex flex-wrap gap-2'>
          <Link className='btn btn-sm btn-light-primary' to={`/mi-renovacion/${item.token}`}>{spanish ? 'Ver mi trámite' : 'View application'}</Link>
          {item.clases_habilitadas && currentUser?.institution?.plan?.features?.includes('aula') && currentUser.permissions.includes('aula.ver_propias') && <Link className='btn btn-sm btn-primary'
            onClick={() => client.removeQueries({queryKey: ['aula', 'catalogo'], type: 'inactive'})} to={`/evaluacion/aula?ano=${item.ano_token}`}>{spanish ? 'Ver mis clases' : 'View my classes'}</Link>}
        </div>
      </article>)}
    </div>
  </section>
}
