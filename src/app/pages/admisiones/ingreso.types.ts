import type {IntlShape} from 'react-intl'
export type Choice = {token: string; nombre: string; ano_token?: string}
export type Requirement = {key: string; nombre: string; instrucciones: string; obligatorio: boolean; formatos: string[]; max_mb: number; grados: string[]}
export type Field = {key: string; nombre: string; obligatorio: boolean; tipo: 'texto' | 'fecha'}
export type Campaign = {url_token?: string; nombre: string; ano_token: string; abierta: boolean; desde: string; hasta: string | null; enlace?: string;
  configuracion: {privacidad: string; grados: {token: string; nombre: string; cupo: number}[]; documentos: Requirement[]; campos: Field[]}}
export type StudentData = {primer_nombre?: string; segundo_nombre?: string; primer_apellido?: string; segundo_apellido?: string;
  nacimiento?: string; tipo_documento?: string; numero_documento?: string; telefono?: string; direccion?: string; adicionales: Record<string, string>}
export type DocumentVersion = {url_token: string; requisito: string; nombre: string; version: number; estado: string; observacion?: string}
export type Application = {url_token: string; radicado: string; email: string; estado: string; datos: StudentData;
  grado_token: string; grado_aprobado_token?: string; observacion?: string; campana: Campaign; documentos: DocumentVersion[];
  historial: {evento: string; observacion?: string; created_at: string}[]; grupo?: string}
export type Allocation = {solicitud_token: string; nombre: string; grupo_token: string; grupo: string}
export type Catalog = {anos: Choice[]; grados: Choice[]; campanas: Campaign[]; correo_operativo: boolean}
export type ApplicationsPage = {data: Application[]; page: number; last_page: number; total: number;
  grupos: {token: string; grado_token: string; nombre: string; cupo: number | null}[]}
export const enrollmentStateKeys = ["borrador","enviada","revision","correcciones","espera","aprobada","rechazada","matriculada","pendiente","aprobado","rechazado","documento_cargado","documento_aprobado","documento_rechazado","cambio_grado"] as const
export function getEnrollmentStates(intl: IntlShape): Record<string, string> {
  return Object.fromEntries(enrollmentStateKeys.map(key => [key, intl.formatMessage({id: 'intake.state.' + key})]))
}
