import {FC} from 'react'
import {Route, Routes, Outlet} from 'react-router-dom'
import {PageLink, PageTitle} from '@/_metronic/layout/core'
import {useIntl} from 'react-intl'
import {BoletinView} from './components/BoletinView'
import {CatalogoView} from '../evaluacion/components/CatalogoView'
import {Content} from '@/_metronic/layout/components/content'

const BoletinesPage: FC = () => {
  const intl = useIntl()
  const breadcrumbs: Array<PageLink> = [
    {title: intl.formatMessage({id: 'academico.title'}), path: '/academico/anos-lectivos', isSeparator: false, isActive: false},
  ]

  return (
    <Routes>
      <Route element={<Content><Outlet /></Content>}>
        <Route
          path=':matriculaId'
          element={
            <>
              <PageTitle breadcrumbs={breadcrumbs}>
                {intl.formatMessage({id: 'academico.boletines.title'})}
              </PageTitle>
              <BoletinView />
            </>
          }
        />
        <Route index element={<><PageTitle breadcrumbs={breadcrumbs}>{intl.formatMessage({id: 'boletines.title'})}</PageTitle><CatalogoView reportsOnly /></>} />
      </Route>
    </Routes>
  )
}

export default BoletinesPage
