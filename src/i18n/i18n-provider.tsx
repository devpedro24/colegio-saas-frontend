import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY } from './config';
import type { Locale } from './config';
import { I18nContext } from './i18n-context';
import en from './messages/en.json';
import es from './messages/es.json';

// Convencion: claves semanticas (ej. 'colegios.create'); el texto vive en los
// catalogos por idioma: es.json (espanol) y en.json (ingles).
const MESSAGES: Record<Locale, Record<string, string>> = {
  es,
  en,
};

function getInitialLocale(): Locale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const contextValue = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <I18nContext.Provider value={contextValue}>
      <IntlProvider
        locale={locale}
        defaultLocale="es"
        messages={MESSAGES[locale]}
        onError={() => {
          // En espanol la clave ES el texto: ignoramos los avisos de traduccion faltante.
        }}
      >
        {children}
      </IntlProvider>
    </I18nContext.Provider>
  );
}
