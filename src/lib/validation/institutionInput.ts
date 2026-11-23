export const institutionNamePattern = String.raw`(?=.*\p{L})[\p{L}\p{M}0-9 .,'’"&\(\)\/#º°:+\-]+`
export const nitPattern = String.raw`[0-9]+(?:\.[0-9]+)*(?:-[0-9])?`

export const cleanInstitutionName = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').replace(/[^\p{L}\p{M}0-9 .,'’"()&/#º°:+-]/gu, '')
export const cleanInstitutionText = (value: string) => Array.from(value.normalize('NFC').replace(/\s+/g, ' ')).filter(char => {
  const code = char.codePointAt(0)!
  return char !== '<' && char !== '>' && code >= 32 && code !== 127
}).join('')
export const cleanSedeSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63)

export const cleanInstitutionField = (field: string, value: string) => field === 'nombre' ? cleanInstitutionName(value)
  : field === 'nit' ? value.replace(/[^0-9.-]/g, '') : field === 'correo' ? value : cleanInstitutionText(value)

export const institutionFieldProps = (field: string) => ({
  maxLength: field === 'nit' ? 60 : field === 'telefono' ? 32 : 255,
  pattern: field === 'nombre' ? institutionNamePattern : field === 'nit' ? nitPattern : undefined,
  inputMode: field === 'nit' ? 'numeric' as const : undefined,
})
