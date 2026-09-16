import type {IntlShape} from 'react-intl'

type HeaderMenuOptions = {
  isPlatform?: boolean
  isTenantUser?: boolean
  activeColegio?: boolean
  canManageUsers?: boolean
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

export const getHeaderMenuHtml = (intl: IntlShape, options: HeaderMenuOptions = {}) => {
  const t = (id: string, defaultMessage: string) =>
    escapeHtml(intl.formatMessage({id, defaultMessage}))

  const item = (path: string, label: string) => String.raw`
    <div class="menu-item">
      <a class="menu-link" href="${path}" data-kt-nav="${path}">
        <span class="menu-bullet"><span class="bullet bullet-dot"></span></span>
        <span class="menu-title">${label}</span>
      </a>
    </div>`

  const group = (title: string, items: string, width = '225px') => String.raw`
    <div
      data-kt-menu-trigger="{default: 'click', lg: 'hover'}"
      data-kt-menu-placement="bottom-start"
      class="menu-item menu-lg-down-accordion menu-sub-lg-down-indention me-0 me-lg-2"
    >
      <span class="menu-link">
        <span class="menu-title">${title}</span>
        <span class="menu-arrow d-lg-none"></span>
      </span>
      <div class="menu-sub menu-sub-lg-down-accordion menu-sub-lg-dropdown px-lg-2 py-lg-4 w-lg-${width}">
        ${items}
      </div>
    </div>`

  const colegioMode =
    options.isTenantUser === true ||
    (options.isPlatform === true && options.activeColegio === true)
  const platformMode = options.isPlatform === true && options.activeColegio !== true

  const academic = colegioMode
    ? group(
        t('academico.title', 'Académico'),
        [
          item('/academico/anos-lectivos', t('academico.anos.title', 'Años lectivos')),
          item(
            '/academico/estructura',
            t('academico.estructura.title', 'Estructura organizacional')
          ),
          item(
            '/academico/configuracion',
            t('academico.config.title', 'Configuración del colegio')
          ),
        ].join(''),
        '250px'
      )
    : ''

  const users =
    colegioMode && options.canManageUsers === true
      ? group(
          t('header.menu.userManagement', 'Gestión de usuarios'),
          item('/usuarios', t('header.menu.users', 'Usuarios'))
        )
      : ''

  const platform = platformMode
    ? group(
        t('header.menu.config', 'Configuración'),
        [
          item('/configuracion/colegios', t('colegios.title', 'Colegios')),
          item('/configuracion/planes', t('common.plans', 'Planes')),
          item(
            '/configuracion/roles-permisos',
            t('rbac.title', 'Roles y permisos')
          ),
        ].join('')
      )
    : ''

  return `${academic}${users}${platform}`
}
