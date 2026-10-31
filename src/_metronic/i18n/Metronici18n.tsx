/* eslint-disable react-refresh/only-export-components */
import {FC, createContext, useContext, useEffect, useState} from 'react'
import {WithChildren} from '../helpers'
import {applyDocumentLanguage, deviceLanguages, resolveLanguage, savedLanguage, supportedLanguage, type AppLanguage} from './language'

const I18N_CONFIG_KEY = import.meta.env.VITE_APP_I18N_CONFIG_KEY || 'i18nConfig'
let sessionLanguage: AppLanguage | undefined

type Props = {
  selectedLang: AppLanguage
}
const initialState: Props = {
  selectedLang: 'en',
}

function getConfig(): Props {
  return {selectedLang: sessionLanguage ?? resolveLanguage(savedLanguage(I18N_CONFIG_KEY), deviceLanguages())}
}

const LANGUAGE_CHANGED = 'school:language-changed'
// Only explicit choices persist. Updating React in place keeps unfinished forms intact.
export function setLanguage(lang: string) {
  const language = supportedLanguage(lang)
  if (!language) return
  sessionLanguage = language
  try {localStorage.setItem(I18N_CONFIG_KEY, JSON.stringify({selectedLang: language}))} catch { /* keep this session's choice */ }
  applyDocumentLanguage(language)
  window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGED, {detail: language}))
}

export function initializeLanguage(): void {
  applyDocumentLanguage(getConfig().selectedLang)
}

const I18nContext = createContext<Props>(initialState)

const useLang = () => {
  return useContext(I18nContext).selectedLang
}

const MetronicI18nProvider: FC<WithChildren> = ({children}) => {
  const [lang, setConfig] = useState(getConfig)
  useEffect(() => {
    const refresh = () => setConfig(getConfig())
    const storage = (event: StorageEvent) => {
      if (event.key === I18N_CONFIG_KEY || event.key === null) {sessionLanguage = undefined; refresh()}
    }
    const selected = (event: Event) => {
      const language = supportedLanguage((event as CustomEvent<unknown>).detail)
      if (language) setConfig({selectedLang: language})
    }
    window.addEventListener(LANGUAGE_CHANGED, selected)
    window.addEventListener('languagechange', refresh)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener(LANGUAGE_CHANGED, selected)
      window.removeEventListener('languagechange', refresh)
      window.removeEventListener('storage', storage)
    }
  }, [])
  return <I18nContext.Provider value={lang}>{children}</I18nContext.Provider>
}

export {MetronicI18nProvider, useLang}
