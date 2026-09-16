import {FC} from 'react'
import {Link} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '../../../_metronic/layout/core'
import {ToolbarWrapper} from '../../../_metronic/layout/components/toolbar'
import {Content} from '../../../_metronic/layout/components/content'
import {useAuth} from '@/app/modules/auth'
import {useAuthz} from '@/app/modules/auth/core/authz'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'

const dashboardBreadcrumbs: Array<PageLink> = [
  {title: 'Inicio', path: '/dashboard', isSeparator: false, isActive: true},
]

const DashboardWrapper: FC = () => {
  const intl = useIntl()
  const {currentUser} = useAuth()
  const authz = useAuthz()
  const {activeColegio} = useImpersonation()
  const tenantContext = !authz.isPlatform || activeColegio !== null

  const links = [
    authz.isPlatform && !activeColegio
      ? {to: '/configuracion/colegios', icon: 'ki-school', label: 'Colegios'}
      : null,
    authz.isPlatform && !activeColegio
      ? {to: '/configuracion/planes', icon: 'ki-price-tag', label: 'Planes'}
      : null,
    tenantContext
      ? {to: '/academico/configuracion', icon: 'ki-setting-2', label: 'Configuración académica'}
      : null,
    tenantContext
      ? {to: '/academico/estructura', icon: 'ki-abstract-26', label: 'Estructura'}
      : null,
    tenantContext && authz.hasPermission('usuarios.gestionar')
      ? {to: '/usuarios', icon: 'ki-people', label: 'Usuarios'}
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <>
      <PageTitle breadcrumbs={dashboardBreadcrumbs}>
        {intl.formatMessage({id: 'dashboard.title', defaultMessage: 'Inicio'})}
      </PageTitle>
      <ToolbarWrapper />
      <Content>
        <div className='card mb-8'>
          <div className='card-body py-10'>
            <span className='badge badge-light-primary mb-4'>
              {activeColegio
                ? 'Administración temporal'
                : authz.isPlatform
                  ? 'Plataforma'
                  : 'Colegio'}
            </span>
            <h1 className='text-gray-900 fw-bold mb-3'>
              {intl.formatMessage(
                {id: 'dashboard.welcome', defaultMessage: 'Hola, {name}'},
                {name: currentUser?.name ?? ''},
              )}
            </h1>
            <p className='text-gray-600 fs-5 mb-0'>
              {activeColegio
                ? 'Estás administrando ' + activeColegio.name + '. Todas las acciones quedan auditadas.'
                : authz.isPlatform
                  ? 'Gestiona colegios, planes y permisos desde la plataforma central.'
                  : 'Gestiona la operación académica autorizada para tu rol.'}
            </p>
          </div>
        </div>

        <div className='row g-5 g-xl-8'>
          {links.map((item) => (
            <div className='col-sm-6 col-xl-4' key={item.to}>
              <Link to={item.to} className='card card-flush h-100 hover-elevate-up text-decoration-none'>
                <div className='card-body d-flex align-items-center gap-4 py-7'>
                  <span className='symbol symbol-50px bg-light-primary'>
                    <span className='symbol-label'>
                      <i className={'ki-duotone ' + item.icon + ' fs-2x text-primary'}></i>
                    </span>
                  </span>
                  <div>
                    <div className='text-gray-900 fw-bold fs-5'>{item.label}</div>
                    <div className='text-muted fs-7'>Abrir módulo</div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </Content>
    </>
  )
}

export {DashboardWrapper}
