export const LOCALES = ['es', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Idioma por defecto de la plataforma (es-CO). */
export const DEFAULT_LOCALE: Locale = 'es';

/** Clave de localStorage donde se persiste el idioma elegido. */
export const LOCALE_STORAGE_KEY = 'app-locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

/** Bandera (SVG en /public/media/flags) por idioma. */
export const LOCALE_FLAGS: Record<Locale, string> = {
  es: '/media/flags/colombia.svg',
  en: '/media/flags/united-states.svg',
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'es' || value === 'en';
}
