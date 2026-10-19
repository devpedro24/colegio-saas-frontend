import {FC} from 'react'
import {Route, Routes, Outlet, Link, Navigate} from 'react-router-dom'
import {PageLink, PageTitle} from '@/_metronic/layout/core'
import {useIntl} from 'react-intl'
import {BoletinView} from './components/BoletinView'
import {CatalogoView} from '../evaluacion/components/CatalogoView'
import {Content} from '@/_metronic/layout/components/content'
import {useAuthz} from '@/app/modules/auth/core/authz'
import PlantillasPage from './PlantillasPage'

const BoletinesPage: FC = () => {
  const intl = useIntl()
  const {hasPermission} = useAuthz()
  const breadcrumbs: Array<PageLink> = [
    {title: intl.formatMessage({id: 'academico.title'}), path: '/academico/anos-lectivos', isSeparator: false, isActive: false},
  ]

  return (
    <Routes>
      <Route element={<Content><Outlet /></Content>}>
        <Route path='plantillas' element={hasPermission('boletines.plantillas.ver') || hasPermission('boletines.plantillas.gestionar')
          ? <><PageTitle breadcrumbs={breadcrumbs}>{intl.formatMessage({id: 'templates.title'})}</PageTitle><PlantillasPage /></>
          : <Navigate to='/academico/boletines' replace />} />
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
        <Route index element={<><PageTitle breadcrumbs={breadcrumbs}>{intl.formatMessage({id: 'boletines.title'})}</PageTitle>
          {(hasPermission('boletines.plantillas.ver') || hasPermission('boletines.plantillas.gestionar')) &&
            <div className='d-flex justify-content-end mb-5'><Link className='btn btn-light-primary' to='/academico/boletines/plantillas'>
              {intl.formatMessage({id: 'templates.openEditor'})}</Link></div>}
          <CatalogoView reportsOnly /></>} />
      </Route>
    </Routes>
  )
}

export default BoletinesPage
