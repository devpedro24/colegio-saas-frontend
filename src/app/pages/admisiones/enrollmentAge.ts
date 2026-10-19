import type {AgeValidation} from './ingreso.types'

/** Calendar date at the school, independent of the browser's time zone. */
export function schoolDate(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now)
  const part = (name: string) => parts.find(p => p.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function ageOnDate(birth: string | undefined, date: string): number | null {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth > date) return null
  const parsed = new Date(`${birth}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birth) return null
  return Number(date.slice(0, 4)) - Number(birth.slice(0, 4)) - (date.slice(5) < birth.slice(5) ? 1 : 0)
}

export function hasValidatedAge(snapshot: AgeValidation | null | undefined, birth: string | undefined, grade: string | undefined): boolean {
  return !!snapshot && snapshot.nacimiento === birth && snapshot.grado_token === grade
}

export function isOutsideAgeRange(birth: string | undefined, grade: string | undefined, date: string,
  range: {edad_min?: number | null; edad_max?: number | null} | undefined, snapshot?: AgeValidation | null): boolean {
  if (hasValidatedAge(snapshot, birth, grade) || range?.edad_min == null || range.edad_max == null) return false
  const age = ageOnDate(birth, date)
  return age === null || age < range.edad_min || age > range.edad_max
}
