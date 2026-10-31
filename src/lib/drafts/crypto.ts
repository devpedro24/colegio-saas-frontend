export const DRAFT_TTL = 24 * 60 * 60 * 1000
export const newDraftToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, '-').replace(/\//g, '_')
export const encode64 = (data: ArrayBuffer) => {
  const bytes = new Uint8Array(data); let text = ''
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(text)
}
export const decode64 = (data: string) => Uint8Array.from(atob(data), char => char.charCodeAt(0))
export const importDraftKey = (key: string) => crypto.subtle.importKey('raw', decode64(key), 'AES-GCM', false, ['encrypt', 'decrypt'])
export async function encryptDraft(key: CryptoKey, scope: string, token: string, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv,
    additionalData: new TextEncoder().encode(`${scope}:${token}`)}, key, new TextEncoder().encode(JSON.stringify(value)))
  return {iv: encode64(iv.buffer), ciphertext: encode64(ciphertext)}
}
export async function decryptDraft<T>(key: CryptoKey, scope: string, token: string, value: {iv: string; ciphertext: string}): Promise<T> {
  const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: decode64(value.iv),
    additionalData: new TextEncoder().encode(`${scope}:${token}`)}, key, decode64(value.ciphertext))
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

/** Never accept origins, credentials, auth flows or executable URLs as return destinations. */
export function safeDraftPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return null
  const url = new URL(value, 'https://draft.invalid')
  if (url.origin !== 'https://draft.invalid' || !/^\/(academico|evaluacion|comunicacion|admisiones|usuarios|configuracion|ajustes-institucionales|account|dashboard|mis-borradores)(\/|$)/.test(url.pathname)) return null
  // Account security screens must not be restored with password reset tokens, etc.
  if (/password|reset|mfa|google|logout/.test(url.pathname)) return null
  const allowed = new Set(['ano', 'grupo', 'materia', 'asignacion', 'periodo', 'grado', 'seccion', 'recurso', 'editar', 'crear_recurso', 'tab', 'desde', 'evento', 'page'])
  for (const key of [...url.searchParams.keys()]) if (!allowed.has(key)) url.searchParams.delete(key)
  return url.pathname + url.search
}
