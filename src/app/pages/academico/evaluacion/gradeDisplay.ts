/** Presentación a una décima (SIEE HALF_DOWN), sin floats ni alterar el cálculo. */
export function gradeDisplay(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  const match = String(value).trim().replace(',', '.').match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!match) return '—'
  const [, sign, whole, fraction = ''] = match
  let tenths = BigInt(whole) * 10n + BigInt(fraction[0] ?? '0')
  const next = fraction[1] ?? '0'
  if (next > '5' || (next === '5' && /[1-9]/.test(fraction.slice(2)))) tenths += 1n
  return `${tenths === 0n ? '' : sign}${tenths / 10n}.${tenths % 10n}`
}
