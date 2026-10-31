import type {AttendanceSheetColumn, AttendanceState} from './asistencia.api'

const colombiaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function attendanceToday(now = new Date()): string {
  const parts = colombiaDate.formatToParts(now)
  const part = (type: string) => parts.find(value => value.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function preferredAttendanceColumn(columns: AttendanceSheetColumn[], today: string): AttendanceSheetColumn | undefined {
  // Prefer today's first class, then the most recent past class, then the first future class.
  return columns.find(column => column.fecha === today)
    ?? [...columns].reverse().find(column => column.fecha < today)
    ?? columns[0]
}

export function canEditAttendanceMark(column: AttendanceSheetColumn, token: string, today: string): boolean {
  const original = column.marcas[token] ?? 'sin_marcar'
  return column.editable && column.matriculas.includes(token)
    && original !== 'justificada' && original !== 'tarde'
    && (original !== 'ausente' || column.fecha === today)
}

export function nextAttendanceMark(original: AttendanceState, current: AttendanceState,
  choice: 'presente' | 'ausente'): AttendanceState {
  // A saved absence is corrected explicitly to Present, never silently cleared.
  if (original === 'ausente') return choice
  return current === choice ? 'sin_marcar' : choice
}
