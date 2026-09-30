import {FC} from 'react'
import {useIntl} from 'react-intl'
import {Link, useSearchParams} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {
  AcademicYearContent,
  AcademicYearPicker,
  AcademicYearProvider,
  useAcademicYear,
} from '../academic-year-context'
import {EscalasCard} from './components/EscalasCard'
import {MetodosAprobacionCard} from './components/MetodosAprobacionCard'
import {ModelosPedagogicosCard} from './components/ModelosPedagogicosCard'

type Tab = 'escala' | 'metodo' | 'modelo'
const tabs: Tab[] = ['escala', 'metodo', 'modelo']

const AcademicParametersContent: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [searchParams] = useSearchParams()
  const {yearToken} = useAcademicYear()
  const requestedTab = searchParams.get('tab') as Tab | null
  const tab: Tab = requestedTab && tabs.includes(requestedTab) ? requestedTab : 'escala'

  return (
    <div className='card'>
      <div className='card-header border-0 pt-6'>
        <div className='card-title flex-column align-items-start'>
          <h3 className='fw-bold mb-1'>{t('academico.parameters.title')}</h3>
          <span className='text-muted fs-7'>{t('academico.parameters.subtitle')}</span>
        </div>
        <div className='card-toolbar'><AcademicYearPicker /></div>
      </div>
      <div className='card-body py-4'>
        <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-6 fw-semibold mb-6'>
          {tabs.map((item) => {
            const nextParams = new URLSearchParams(searchParams)
            nextParams.set('tab', item)
            return (
              <li className='nav-item' key={item}>
                <Link
                  className={`nav-link pb-2 ${tab === item ? 'active text-primary' : 'text-muted'}`}
                  aria-current={tab === item ? 'page' : undefined}
                  to={`?${nextParams.toString()}`}
                >
                  {t(`academico.config.tab.${item}`)}
                </Link>
              </li>
            )
          })}
        </ul>

        <AcademicYearContent>
          {tab === 'escala' && <EscalasCard anoLectivoToken={yearToken} />}
          {tab === 'metodo' && <MetodosAprobacionCard anoLectivoToken={yearToken} />}
          {tab === 'modelo' && <ModelosPedagogicosCard anoLectivoToken={yearToken} />}
        </AcademicYearContent>
      </div>
    </div>
  )
}

const ConfiguracionColegioPage: FC = () => {
  const intl = useIntl()
  const breadcrumbs: PageLink[] = [{
    title: intl.formatMessage({id: 'academico.title'}),
    path: '/academico/anos-lectivos',
    isSeparator: false,
    isActive: false,
  }]

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{intl.formatMessage({id: 'academico.parameters.title'})}</PageTitle>
      <Content>
        <AcademicYearProvider><AcademicParametersContent /></AcademicYearProvider>
      </Content>
    </>
  )
}

export default ConfiguracionColegioPage
