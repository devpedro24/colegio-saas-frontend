import {useIntl} from 'react-intl'
import type {Application} from './ingreso.types'

export function useIntakeText() {
  const intl = useIntl()
  return (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id: `intake.flow.${key}`}, values)
}
export const studentName = (application: Application) =>
  [
    application.datos.primer_nombre,
    application.datos.segundo_nombre,
    application.datos.primer_apellido,
    application.datos.segundo_apellido,
  ]
    .filter(Boolean)
    .join(' ')
export const editableElement = (application: Application, field: string) =>
  application.estado === 'borrador' ||
  (application.estado === 'correcciones' &&
    !!application.correcciones?.some((entry) => !entry.resuelta && entry.campo === field))
