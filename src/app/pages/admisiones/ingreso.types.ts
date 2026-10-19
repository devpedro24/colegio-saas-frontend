import type {IntlShape} from 'react-intl'
export type Choice = {token: string; nombre: string; ano_token?: string; regla_token?: string}
export type Requirement = {key: string; nombre: string; instrucciones: string; obligatorio: boolean; formatos: string[]; grados: string[]}
export type Field = {key: string; nombre: string; obligatorio: boolean; tipo: 'texto' | 'fecha'}
export type EnrollmentSettings = {version: number; requiere_revision: boolean; privacidad: string; zona_horaria: string;
  grados: {url_token: string; nombre: string; nivel: string; edad_min: number | null; edad_max: number | null}[]}
export type EnrollmentSettingsInput = Pick<EnrollmentSettings, 'version' | 'privacidad'> & {
  grados: Pick<EnrollmentSettings['grados'][number], 'url_token' | 'edad_min' | 'edad_max'>[]}
export type AgeValidation = {nacimiento: string; grado_token: string; edad: number; fecha: string; edad_min: number | null; edad_max: number | null}
export type Campaign = {url_token?: string; nombre: string; ano_token: string; abierta: boolean; desde: string; hasta: string | null; enlace?: string; zona_horaria?: string; privacidad_version?: string;
  configuracion: {privacidad: string; pin_expira_en?: string | null; documento_identidad?: string | null; grados: {token: string; nombre: string; cupo: number | null; edad_min?: number | null; edad_max?: number | null}[]; documentos: Requirement[]; campos: Field[]}}
export type CampaignInput = Pick<Campaign, 'url_token' | 'nombre' | 'ano_token' | 'abierta' | 'desde' | 'hasta'> & {
  configuracion: Omit<Campaign['configuracion'], 'privacidad' | 'grados'> & {grados: {token: string; nombre: string; cupo: number | null}[]}}
export type StudentData = {primer_nombre?: string; segundo_nombre?: string; primer_apellido?: string; segundo_apellido?: string;
  nacimiento?: string; tipo_documento?: string; numero_documento?: string; telefono?: string; direccion?: string; pais?: string; departamento?: string; municipio?: string; adicionales: Record<string, string>}
export type DocumentVersion = {url_token: string; requisito: string; nombre: string; version: number; estado: string; observacion?: string}
export type Application = {url_token: string; radicado: string; email: string; estado: string; datos: StudentData;
  renovacion?: boolean;
  grado_token: string; grado_aprobado_token?: string; observacion?: string; campana: Campaign; documentos: DocumentVersion[]; validacion_edad?: AgeValidation | null;
  historial: {evento: string; observacion?: string; created_at: string}[]; grupo?: string}
export type Allocation = {solicitud_token: string; nombre: string; grupo_token: string; grupo: string}
export type Catalog = {anos: Choice[]; grados: Choice[]; campanas: Campaign[]; correo_operativo: boolean; zona_horaria?: string}
export type ApplicationsPage = {data: Application[]; page: number; last_page: number; total: number;
  grupos: {token: string; grado_token: string; nombre: string; cupo: number | null}[]}
export const enrollmentStateKeys = ["borrador","enviada","revision","correcciones","espera","aprobada","rechazada","matriculada","pendiente","aprobado","rechazado","retirado","documento_cargado","documento_aprobado","documento_rechazado","documento_retirado","cambio_grado"] as const
export function getCampaignStatus(intl: IntlShape, campaign: Pick<Campaign, 'abierta' | 'hasta'>): string {
  if (!campaign.abierta) return intl.formatMessage({id: 'intake.campaignStatus.unpublished'})
  if (!campaign.hasta) return intl.formatMessage({id: 'intake.campaignStatus.openEnded'})
  return intl.formatMessage({id: 'intake.campaignStatus.openUntil'}, {date: campaign.hasta})
}
export function getEnrollmentStates(intl: IntlShape): Record<string, string> {
  return Object.fromEntries(enrollmentStateKeys.map(key => [key, intl.formatMessage({id: 'intake.state.' + key})]))
}
