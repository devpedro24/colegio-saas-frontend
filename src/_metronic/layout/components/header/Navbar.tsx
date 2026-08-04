import {useEffect} from 'react'
import {useIntl} from 'react-intl'
import {useNavigate} from 'react-router-dom'
import {toAbsoluteUrl, withBase} from '../../../helpers'
import {getNavbarHtml} from './_NavbarContent'
import {ThemeModeComponent} from '../../../assets/ts/layout'
import {setLanguage, useLang} from '../../../i18n/Metronici18n'
import {useAuth} from '../../../../app/modules/auth'

// Idiomas soportados (badge del trigger + estado activo). El submenu de demo46 se recorto a
// English + Spanish, cada item con data-kt-lang. El nombre visible se traduce con i18n.
const LANGS: Record<string, {nameId: string; nameDefault: string; flag: string}> = {
  en: {nameId: 'header.lang.en', nameDefault: 'Inglés', flag: 'united-states'},
  es: {nameId: 'header.lang.es', nameDefault: 'Español', flag: 'spain'},
}

// app-navbar de demo46 (inyectada). El modo de tema (Light/Dark/System) lo maneja el
// ThemeModeComponent NATIVO de Metronic (sin estado React -> no re-renderiza el Navbar, asi
// que la instancia de KTMenu del user menu no se rompe al cambiar de modo). Aqui solo
// cableamos, en fase de captura: My Profile (data-kt-nav -> navigate) e idioma (data-kt-lang).
const Navbar = () => {
  const navigate = useNavigate()
  const lang = useLang()
  const intl = useIntl()
  const {logout} = useAuth()

  useEffect(() => {
    // Modo de tema: init nativo (bindea clicks de [data-kt-element="mode"], aplica el modo
    // actual y marca el item activo; el icono sun/moon del trigger se actualiza por CSS).
    ThemeModeComponent.init()

    // Idioma: marcar el item activo y actualizar el badge del trigger con el idioma actual.
    document.querySelectorAll<HTMLElement>('[data-kt-lang]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-kt-lang') === lang)
    })
    const current = LANGS[lang] || LANGS.en
    const currentName = intl.formatMessage({id: current.nameId, defaultMessage: current.nameDefault})
    const display = document.querySelector<HTMLElement>('[data-kt-lang-display]')
    if (display) {
      display.innerHTML =
        `${currentName} ` +
        `<img class="w-15px h-15px rounded-1 ms-2" src="${toAbsoluteUrl(
          'media/flags/' + current.flag + '.svg'
        )}" alt="" />`
    }

    const onClick = (e: Event) => {
      const target = e.target as HTMLElement

      // Cerrar sesion (Sign Out del user menu) -> logout de React (limpia auth y redirige al login)
      const out = target.closest<HTMLElement>('[data-kt-action="logout"]')
      if (out) {
        e.preventDefault()
        logout()
        return
      }

      // Navegacion interna (React Router) desde items del user menu (ej. My Profile)
      const nav = target.closest<HTMLElement>('[data-kt-nav]')
      if (nav) {
        const to = nav.getAttribute('data-kt-nav')
        if (to) {
          e.preventDefault()
          navigate(to)
          return
        }
      }

      // Cambio de idioma (recarga si cambia)
      const langEl = target.closest<HTMLElement>('[data-kt-lang]')
      if (langEl) {
        e.preventDefault()
        const value = langEl.getAttribute('data-kt-lang')
        if (value && value !== lang) {
          setLanguage(value)
        }
        return
      }
    }

    // Fase de CAPTURA: KTMenu hace stopPropagation en algunos .menu-link, asi corremos antes.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate, lang, logout, intl])

  return (
    <div
      className='app-navbar flex-shrink-0'
      dangerouslySetInnerHTML={{__html: withBase(getNavbarHtml(intl))}}
    />
  )
}

export {Navbar}
