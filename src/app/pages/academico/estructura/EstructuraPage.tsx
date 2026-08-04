import {FC, useState} from 'react'
import {useIntl} from 'react-intl'
import {Navigate} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {JornadasTab} from './components/JornadasTab'
import {NivelesTab} from './components/NivelesTab'
import {GradosTab} from './components/GradosTab'
import {GruposTab} from './components/GruposTab'
import {BloquesTab} from './components/BloquesTab'
import {EspaciosTab} from './components/EspaciosTab'
import {useImpersonation} from '../../../modules/impersonation/impersonation.store'

type Tab = 'jornadas' | 'niveles' | 'grados' | 'grupos' | 'bloques' | 'espacios'

// Pagina de Estructura organizacional (Bloque B / Fase 1). Sub-navegacion por
// tabs (Jornada > Nivel > Grado > Grupo > Bloques > Espacios). Las sedes se
// gestionan en Configuración del colegio > Sedes.
const EstructuraPage: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {activeColegio} = useImpersonation()

  const breadcrumbs: Array<PageLink> = [
    {
      title: t('academico.title'),
      path: '/academico/estructura',
      isSeparator: false,
      isActive: false,
    },
  ]

  const [tab, setTab] = useState<Tab>('jornadas')

  // Mismo gating que el resto del modulo Academico: usuario de colegio o
  // superadmin suplantando (activeColegio). Sin impersonacion -> anos lectivos.
  if (!activeColegio) {
    return <Navigate to='/academico/anos-lectivos' replace />
  }

  const tabs: Array<{key: Tab; label: string}> = [
    {key: 'jornadas', label: t('academico.estructura.tab.jornadas')},
    {key: 'niveles', label: t('academico.estructura.tab.niveles')},
    {key: 'grados', label: t('academico.estructura.tab.grados')},
    {key: 'grupos', label: t('academico.estructura.tab.grupos')},
    {key: 'bloques', label: t('academico.estructura.tab.bloques')},
    {key: 'espacios', label: t('academico.estructura.tab.espacios')},
  ]

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{t('academico.estructura.title')}</PageTitle>
      <Content>
        <div className='card'>
          <div className='card-header border-0 pt-6'>
            <div className='card-title flex-column align-items-start'>
              <h3 className='fw-bold mb-1'>{t('academico.estructura.title')}</h3>
              <span className='text-muted fs-7'>{t('academico.estructura.subtitle')}</span>
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
                    }}
                    href='#'
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            {tab === 'jornadas' && <JornadasTab />}
            {tab === 'niveles' && <NivelesTab />}
            {tab === 'grados' && <GradosTab />}
            {tab === 'grupos' && <GruposTab />}
            {tab === 'bloques' && <BloquesTab />}
            {tab === 'espacios' && <EspaciosTab />}
          </div>
        </div>
      </Content>
    </>
  )
}

export default EstructuraPage