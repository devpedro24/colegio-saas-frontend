import {FC, useState} from 'react'
import {useIntl} from 'react-intl'
import {Navigate, useSearchParams} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {useImpersonation} from '../../../modules/impersonation/impersonation.store'
import {useAuthz} from '../../../modules/auth/core/authz'
import {ResumenTab} from './components/ResumenTab'
import {AreasMateriasTab} from './components/AreasMateriasTab'
import {AsignacionesTab} from './components/AsignacionesTab'
import {HorariosTab} from './components/HorariosTab'

type Tab = 'resumen' | 'areas' | 'asignaciones' | 'horarios'

// Plan de estudios (Bloque C / Fase 1): Áreas/materias -> Asignación docente ->
// Horarios. Mismo marco que EstructuraPage (tabs sincronizados en la URL).
const PlanEstudiosPage: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {activeColegio} = useImpersonation()
  const {isPlatform} = useAuthz()

  const breadcrumbs: Array<PageLink> = [
    {
      title: t('academico.title'),
      path: '/academico/plan-estudios',
      isSeparator: false,
      isActive: false,
    },
  ]

  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const valid: Tab[] = ['resumen', 'areas', 'asignaciones', 'horarios']
    const requested = searchParams.get('tab') as Tab | null
    return requested && valid.includes(requested) ? requested : 'resumen'
  })

  // Mismo gating que el resto del modulo Academico.
  if (isPlatform && !activeColegio) {
    return <Navigate to='/academico/anos-lectivos' replace />
  }

  const tabs: Array<{key: Tab; label: string}> = [
    {key: 'resumen', label: t('academico.planEstudios.tab.resumen')},
    {key: 'areas', label: t('academico.planEstudios.tab.areas')},
    {key: 'asignaciones', label: t('academico.planEstudios.tab.asignaciones')},
    {key: 'horarios', label: t('academico.planEstudios.tab.horarios')},
  ]

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{t('academico.planEstudios.title')}</PageTitle>
      <Content>
        <div className='card'>
          <div className='card-header border-0 pt-6'>
            <div className='card-title flex-column align-items-start'>
              <h3 className='fw-bold mb-1'>{t('academico.planEstudios.title')}</h3>
              <span className='text-muted fs-7'>{t('academico.planEstudios.subtitle')}</span>
            </div>
          </div>
          <div className='card-body py-4'>
            <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-6 fw-semibold mb-6'>
              {tabs.map((item) => (
                <li className='nav-item' key={item.key}>
                  <a
                    className={`nav-link pb-2 ${tab === item.key ? 'active text-primary' : 'text-muted'}`}
                    onClick={(e) => {
                      e.preventDefault()
                      setTab(item.key)
                      setSearchParams({tab: item.key})
                    }}
                    href='#'
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            {tab === 'resumen' && <ResumenTab />}
            {tab === 'areas' && <AreasMateriasTab />}
            {tab === 'asignaciones' && <AsignacionesTab />}
            {tab === 'horarios' && <HorariosTab />}
          </div>
        </div>
      </Content>
    </>
  )
}

export default PlanEstudiosPage
