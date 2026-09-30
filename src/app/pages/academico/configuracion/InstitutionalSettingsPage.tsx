import {FC} from 'react'
import {useIntl} from 'react-intl'
import {NavLink, Navigate} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {useAuth} from '../../../modules/auth'
import {useAuthz} from '../../../modules/auth/core/authz'
import {useImpersonation} from '../../../modules/impersonation/impersonation.store'
import {useOnboarding} from '../../../modules/onboarding/onboarding.api'
import {useDatosInstitucionales} from './configuracion.api'
import {DatosInstitucionalesCard} from './components/DatosInstitucionalesCard'
import {SedesConfigTab} from './components/SedesConfigTab'

type Section = 'datos' | 'sedes'

const InstitutionalSettingsContent: FC<{
  section: Section
  canConfigure: boolean
  canManageCampuses: boolean
}> = ({section, canConfigure, canManageCampuses}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const branding = useOnboarding(currentUser?.tenant_channel, !currentUser?.is_platform)
  const {data: official} = useDatosInstitucionales(canConfigure)
  const institution = official?.data ?? branding.data?.institution
  const institutionName = institution?.nombre || activeColegio?.name || t('academico.institutionSettings.title')
  const breadcrumbs: PageLink[] = [{
    title: t('academico.institutionSettings.title'),
    path: '/ajustes-institucionales',
    isSeparator: false,
    isActive: false,
  }]

  const tabs: Array<{key: Section; allowed: boolean}> = [
    {key: 'datos', allowed: canConfigure},
    {key: 'sedes', allowed: canManageCampuses},
  ]

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{t(`academico.config.tab.${section}`)}</PageTitle>
      <Content>
        <div className='card mb-5 mb-xl-10 institutional-settings__header'>
          <div className='card-body pt-9 pb-0'>
            <div className='d-flex flex-wrap flex-sm-nowrap institutional-settings__identity'>
              <div className='me-7 mb-4'>
                <div className='symbol symbol-100px symbol-lg-160px symbol-fixed institutional-settings__symbol'>
                  <img
                    src={branding.data?.logo_url || '/media/logo-colegio-transparent.png'}
                    alt={t('onboarding.logoPreview')}
                  />
                </div>
              </div>
              <div className='flex-grow-1 min-w-0'>
                <div className='d-flex flex-column mb-4'>
                  <span className='text-muted fw-semibold fs-7 text-uppercase mb-2'>
                    {t('academico.institutionSettings.title')}
                  </span>
                  <h2 className='text-gray-900 fs-2 fw-bold mb-2'>{institutionName}</h2>
                  <p className='text-muted fs-6 mb-0'>{t('academico.institutionSettings.subtitle')}</p>
                </div>
                <div className='d-flex flex-wrap fw-semibold fs-6 text-gray-600 gap-5 mb-4'>
                  {institution?.nit && (
                    <span className='d-inline-flex align-items-center'>
                      <i className='ki-solid ki-document fs-4 me-2' aria-hidden='true' />
                      {t('common.field.nit')}: {institution.nit}
                    </span>
                  )}
                  {institution?.correo && (
                    <span className='d-inline-flex align-items-center text-break'>
                      <i className='ki-solid ki-sms fs-4 me-2' aria-hidden='true' />
                      {institution.correo}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <nav className='nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-bold institutional-settings__tabs' aria-label={t('academico.institutionSettings.title')}>
              {tabs.filter(({allowed}) => allowed).map(({key}) => (
                <NavLink
                  key={key}
                  to={`/ajustes-institucionales/${key}`}
                  className={({isActive}) => `nav-link text-active-primary me-10 py-5${isActive ? ' active' : ''}`}
                >
                  {t(`academico.config.tab.${key}`)}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
        {section === 'datos' ? <DatosInstitucionalesCard /> : <SedesConfigTab />}
      </Content>
    </>
  )
}

const InstitutionalSettingsPage: FC<{section: Section}> = ({section}) => {
  const {isPlatform, hasPermission} = useAuthz()
  const {activeColegio} = useImpersonation()
  const inSchool = !isPlatform || !!activeColegio
  const superadminInSchool = isPlatform && !!activeColegio
  const canConfigure = inSchool && (superadminInSchool || hasPermission('academico.configurar'))
  const canManageCampuses = inSchool && (superadminInSchool || hasPermission('academico.estructura.gestionar'))

  if (section === 'datos' && !canConfigure) return <Navigate to='/dashboard' replace />
  if (section === 'sedes' && !canManageCampuses) return <Navigate to='/dashboard' replace />

  return <InstitutionalSettingsContent section={section} canConfigure={canConfigure} canManageCampuses={canManageCampuses} />
}

export default InstitutionalSettingsPage
