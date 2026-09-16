import {useIntl} from 'react-intl'
import {Link} from 'react-router-dom'
import {KTIcon} from '../../../helpers'
import {setLanguage, useLang} from '../../../i18n/Metronici18n'
import {useThemeMode} from '../../../partials/layout/theme-mode/ThemeModeProvider'
import {useAuth} from '../../../../app/modules/auth'

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.[0] || 'U')
    .toUpperCase()
}

const Navbar = () => {
  const intl = useIntl()
  const lang = useLang()
  const {mode, updateMenuMode, updateMode} = useThemeMode()
  const {currentUser, logout} = useAuth()

  const name = currentUser?.name?.trim() || currentUser?.email || 'Usuario'
  const effectiveMode =
    mode === 'system' ? document.documentElement.getAttribute('data-bs-theme') || 'light' : mode
  const nextMode = effectiveMode === 'dark' ? 'light' : 'dark'

  const toggleTheme = () => {
    updateMode(nextMode)
    updateMenuMode(nextMode)
  }

  return (
    <div className='app-navbar flex-shrink-0 align-items-center gap-1 gap-sm-2'>
      <div className='app-navbar-item'>
        <button
          type='button'
          className='btn btn-icon btn-color-white btn-active-color-primary w-35px h-35px'
          onClick={() => setLanguage(lang === 'es' ? 'en' : 'es')}
          title={intl.formatMessage({
            id: 'header.lang.change',
            defaultMessage: 'Cambiar idioma',
          })}
          aria-label={intl.formatMessage({
            id: 'header.lang.change',
            defaultMessage: 'Cambiar idioma',
          })}
        >
          <span className='fw-bold fs-7 text-uppercase'>{lang}</span>
        </button>
      </div>

      <div className='app-navbar-item'>
        <button
          type='button'
          className='btn btn-icon btn-color-white btn-active-color-primary w-35px h-35px'
          onClick={toggleTheme}
          title={intl.formatMessage({
            id: 'header.theme.toggle',
            defaultMessage: 'Cambiar tema',
          })}
          aria-label={intl.formatMessage({
            id: 'header.theme.toggle',
            defaultMessage: 'Cambiar tema',
          })}
        >
          <KTIcon iconName={effectiveMode === 'dark' ? 'sun' : 'moon'} className='fs-2' />
        </button>
      </div>

      <div className='app-navbar-item'>
        <Link
          to='/account/overview'
          className='d-flex align-items-center gap-2 text-white text-hover-primary px-1'
          title={currentUser?.email || name}
        >
          <span className='symbol symbol-35px'>
            <span className='symbol-label bg-light-primary text-primary fw-bold'>
              {getInitials(name)}
            </span>
          </span>
          <span className='d-none d-xl-inline fw-semibold text-truncate mw-150px'>{name}</span>
        </Link>
      </div>

      <div className='app-navbar-item'>
        <button
          type='button'
          className='btn btn-sm btn-color-white btn-active-color-primary px-2 px-sm-3'
          onClick={logout}
        >
          <KTIcon iconName='exit-right' className='fs-2 me-sm-1' />
          <span className='d-none d-sm-inline'>
            {intl.formatMessage({id: 'common.signOut', defaultMessage: 'Salir'})}
          </span>
        </button>
      </div>
    </div>
  )
}

export {Navbar}
