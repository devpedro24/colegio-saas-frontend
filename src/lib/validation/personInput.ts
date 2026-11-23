export const namePattern = String.raw`\p{L}[\p{L}\p{M}]*(?:[ '\u2019\u02BC\-]+\p{L}[\p{L}\p{M}]*)*`

export const cleanName = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').replace(/[^\p{L}\p{M} '\u2019\u02BC-]/gu, '')

/** Preserve existing family data while displaying one of the three choices. */
export function relationshipChoice(value: string): '' | 'Madre' | 'Padre' | 'Otro' {
  const normalized = value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!normalized) return ''
  if (['madre', 'mama'].includes(normalized)) return 'Madre'
  if (['padre', 'papa'].includes(normalized)) return 'Padre'
  return 'Otro'
}
