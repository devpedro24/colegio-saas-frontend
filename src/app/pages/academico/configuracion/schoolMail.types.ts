import type {IntlShape} from 'react-intl'
export type MailAction = 'editar' | 'desconectar'
export type MailRequestState = 'pendiente' | 'aprobada' | 'rechazada' | 'utilizada' | 'vencida' | 'obsoleta'

export type MailRequest = {
  url_token: string
  estado: MailRequestState
  accion: MailAction
  motivo: string
  observacion: string | null
  creada_en: string
  vence_en: string | null
}

export type SchoolMailSettings = {
  configurado: boolean
  email: string | null
  nombre: string | null
  verificado_en: string | null
  transporte_plataforma: boolean
  requiere_autorizacion: boolean
  puede_editar: boolean
  puede_desconectar: boolean
  solicitud: MailRequest | null
}

export type PlatformMailRequest = MailRequest & {
  disponible: boolean
  colegio: {slug: string; nombre: string}
  solicitante: string
}

export function getMailLabels(intl: IntlShape) {
  return {
    mailRequestLabels: Object.fromEntries(["pendiente","aprobada","rechazada","utilizada","vencida","obsoleta"].map(key => [key, intl.formatMessage({id: 'schoolMail.state.' + key})])) as Record<MailRequestState, string>,
    mailActionLabels: {editar: intl.formatMessage({id: 'schoolMail.action.editar'}), desconectar: intl.formatMessage({id: 'schoolMail.action.desconectar'})},
  }
}
