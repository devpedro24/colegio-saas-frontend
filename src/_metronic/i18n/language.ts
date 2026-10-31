export type AppLanguage = 'en' | 'es'

export function supportedLanguage(value: unknown): AppLanguage | undefined {
  if (typeof value !== 'string') return undefined
  const base = value.trim().replace(/_/g, '-').toLowerCase().split('-')[0]
  return base === 'en' || base === 'es' ? base : undefined
}

/** An explicit preference wins; unsupported device languages fall back to English. */
export function resolveLanguage(saved: unknown, preferredLanguages: readonly string[]): AppLanguage {
  const manual = saved && typeof saved === 'object' && 'selectedLang' in saved
    ? supportedLanguage(saved.selectedLang) : undefined
  return manual ?? preferredLanguages.map(supportedLanguage).find(Boolean) ?? 'en'
}

export function savedLanguage(storageKey: string): unknown {
  try {return JSON.parse(window.localStorage.getItem(storageKey) ?? 'null')}
  catch {return null}
}

export function deviceLanguages(): string[] {
  const preferences = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language]
  // Intl is the last resort when the browser does not expose a supported preference.
  try {preferences.push(Intl.DateTimeFormat().resolvedOptions().locale)} catch { /* use English */ }
  return preferences.filter((value): value is string => typeof value === 'string')
}

/** Set the real UI language and the standard no-translation hints on the whole document. */
export function applyDocumentLanguage(language: AppLanguage): void {
  document.documentElement.lang = language
  for (const element of [document.documentElement, document.body]) {
    if (!element) continue
    element.setAttribute('translate', 'no')
    element.classList.add('notranslate')
  }
  const loading = document.querySelector('#splash-screen .loading-text')
  if (loading) loading.textContent = language === 'es' ? 'Cargando…' : 'Loading…'
}
