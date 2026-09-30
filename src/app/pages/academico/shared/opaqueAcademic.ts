/**
 * The academic editor still uses `id` as its local selection key. In opaque
 * responses that key is the public token, never the database primary key.
 * Only structure and study-plan views opt into this adapter while the other
 * academic modules migrate their own request contracts.
 */
export function fromOpaqueAcademic<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map(item => fromOpaqueAcademic(item)) as T
  if (value === null || typeof value !== 'object') return value as T

  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(source)) {
    result[key] = fromOpaqueAcademic(field)
    if (key.endsWith('_token') && key !== 'url_token') {
      result[`${key.slice(0, -6)}_id`] = field
    }
  }
  if (typeof source.url_token === 'string') {
    result.id = source.url_token
    result.hashed_id = source.url_token
  }
  // Institutional sede views only test whether a child tenant exists.
  if ('tenant_slug' in source && !('tenant_id' in result)) result.tenant_id = source.tenant_slug
  return result as T
}

/** Convert local form/filter aliases back to the public token contract. */
export function toOpaqueAcademic(input: object): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    result[key.endsWith('_id') ? `${key.slice(0, -3)}_token` : key] = value
  }
  return result
}

export const opaqueParams = (params: URLSearchParams): URLSearchParams => {
  const result = new URLSearchParams({opaque: '1'})
  params.forEach((value, key) => result.set(key.endsWith('_id') ? `${key.slice(0, -3)}_token` : key, value))
  return result
}
