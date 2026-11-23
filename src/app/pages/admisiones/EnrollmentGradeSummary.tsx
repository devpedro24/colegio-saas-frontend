import {useIntl} from 'react-intl'
import type {Application} from './ingreso.types'

export function EnrollmentGradeSummary({application}: {application: Application}) {
  const spanish = useIntl().locale.startsWith('es')
  const grades = application.campana.configuracion.grados
  const requested = application.grado_nombre ?? grades.find(grade => grade.token === application.grado_token)?.nombre
  const assigned = application.grado_aprobado_nombre ?? grades.find(grade => grade.token === application.grado_aprobado_token)?.nombre
  return <>
    <div data-testid='requested-grade'>
      <div className='intake-muted'>{spanish ? 'Grado solicitado' : 'Requested grade'}</div>
      <strong>{requested || (spanish ? 'Sin seleccionar' : 'Not selected')}</strong>
    </div>
    {application.grado_aprobado_token && application.grado_aprobado_token !== application.grado_token &&
      <div data-testid='school-grade'>
        <div className='intake-muted'>{spanish ? 'Grado definido por el colegio' : 'Grade assigned by the school'}</div>
        <strong>{assigned || '—'}</strong>
      </div>}
  </>
}
