/** Text-only review; never execute a draft's HTML or expose technical identifiers. */
export function draftPreview(value: unknown): string[] {
  const lines: string[] = []
  const visit = (item: unknown, key = '') => {
    if (/(?:token|version|(?:^|_)id$|^base$|^context$|^path$|^type$|^tipo$|^estado$|^selected|^local$|^remote$)/i.test(key)) return
    if (typeof item === 'string' && item.trim() && !/^[\w-]{24}$/.test(item)) {
      const text = /<\/?[a-z][\s\S]*>/i.test(item)
        ? new DOMParser().parseFromString(item.replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi, '\n'), 'text/html').body.textContent ?? ''
        : item
      if (text.trim() && !lines.includes(text.trim())) lines.push(text.trim())
    } else if (Array.isArray(item)) item.forEach(entry => visit(entry))
    else if (item && typeof item === 'object') Object.entries(item).forEach(([field, entry]) => visit(entry, field))
  }
  visit(value)
  return lines
}
