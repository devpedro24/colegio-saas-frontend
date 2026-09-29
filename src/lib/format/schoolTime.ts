/** Presenta una hora local sin aplicar conversiones de zona horaria. */
export function formatSchoolTime(value: string | null | undefined): string {
  if (!value) return '—'

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!match) return value

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return value

  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`
}
