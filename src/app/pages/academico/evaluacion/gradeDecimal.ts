/** Keep entered decimals as text, including through clipboard and JSON. */
export function gradeDecimal(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  const normalized = String(value).trim().replace(',', '.')
  if (!/^-?\d+(?:\.\d*)?$/.test(normalized)) return normalized
  const [whole, fraction = ''] = normalized.split('.')
  const decimals = fraction.replace(/0+$/, '')
  return `${whole.replace(/^(-?)0+(?=\d)/, '$1')}${decimals ? `.${decimals}` : ''}`
}

export function validGrade(value: string, minimum: string, maximum: string): boolean {
  return value === '' || (/^\d+(?:\.\d{1,8})?$/.test(value) && Number(value) >= Number(minimum) && Number(value) <= Number(maximum))
}
