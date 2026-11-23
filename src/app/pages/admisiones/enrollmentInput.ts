import type {Field} from './ingreso.types'
import {cleanName, namePattern} from '@/lib/validation/personInput'
export {cleanName, namePattern} from '@/lib/validation/personInput'

export const nameFields = ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'madre', 'padre', 'responsable']
export const numericIdentity = (type?: string) => ['CC', 'TI', 'RC'].includes(type ?? '')
export const identityPattern = (type?: string) => numericIdentity(type) ? '[0-9]{3,40}' : String.raw`[A-Za-z0-9][A-Za-z0-9\-]{1,38}[A-Za-z0-9]`
export const cleanText = (value: string) => Array.from(value).filter(char => {
  const code = char.codePointAt(0)!
  return char !== '<' && char !== '>' && code !== 127 && (code >= 32 || [9, 10, 13].includes(code))
}).join('')
export const cleanIdentity = (value: string, type?: string) => (numericIdentity(type) ? value.replace(/\D/g, '') : value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()).slice(0, 40)

export function additionalType(field: Field): Field['tipo'] | 'nombre' | 'parentesco' | 'identificacion' | 'identificacion_numerica' {
  if (field.tipo !== 'texto') return field.tipo
  const label = `${field.key} ${field.nombre}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]+/g, ' ').toLowerCase()
  if (/\b(telefono|celular|movil)\b/.test(label)) return 'telefono'
  if (/\b(correo|email|e mail)\b/.test(label)) return 'email'
  if (/\b(pasaporte|extranjeria)\b/.test(label)) return 'identificacion'
  if (/\b(cedula|cc|ti|rc|nuip)\b/.test(label)) return 'identificacion_numerica'
  if (/\b(identificacion|identidad)\b/.test(label)) return 'identificacion'
  if (/\b(parentesco|relacion|vinculo)\b/.test(label)) return 'parentesco'
  if (/\b(nombres?|apellidos?)\b/.test(label) && !/\b(colegio|institucion|empresa|programa|sede|curso|grado|barrio|archivo|documento)\b/.test(label)) return 'nombre'
  return 'texto'
}

export function additionalInput(field: Field) {
  const kind = additionalType(field)
  return {
    type: kind === 'fecha' ? 'date' : kind === 'email' ? 'email' : 'text',
    inputMode: kind === 'numero' || kind === 'identificacion_numerica' ? 'numeric' as const : undefined,
    maxLength: kind === 'nombre' ? 160 : kind === 'parentesco' ? 100 : kind === 'email' ? 255 : kind.startsWith('identificacion') ? 40 : 1000,
    pattern: kind === 'nombre' || kind === 'parentesco' ? namePattern : kind === 'numero' ? '[0-9]+' : kind.startsWith('identificacion') ? identityPattern(kind === 'identificacion_numerica' ? 'CC' : 'OTRO') : undefined,
  }
}

export function cleanAdditional(field: Field, value: string) {
  const kind = additionalType(field)
  if (kind === 'nombre' || kind === 'parentesco') return cleanName(value)
  if (kind === 'numero') return value.replace(/\D/g, '')
  if (kind.startsWith('identificacion')) return cleanIdentity(value, kind === 'identificacion_numerica' ? 'CC' : 'OTRO')
  return cleanText(value)
}
