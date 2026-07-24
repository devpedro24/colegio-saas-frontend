import { createContext, useContext } from 'react';
import type { Locale } from './config';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n debe usarse dentro de <I18nProvider>');
  }
  return ctx;
}
