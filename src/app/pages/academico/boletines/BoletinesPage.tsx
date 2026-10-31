import {FC} from 'react'
import {Route, Routes, Outlet, Link, Navigate} from 'react-router-dom'
import {PageLink, PageTitle} from '@/_metronic/layout/core'
import {useIntl} from 'react-intl'
import {BoletinView} from './components/BoletinView'
import {CatalogoView} from '../evaluacion/components/CatalogoView'
import {Content} from '@/_metronic/layout/components/content'
import {useAuthz} from '@/app/modules/auth/core/authz'
import PlantillasPage from './PlantillasPage'
import BulletinWorkspace from './BulletinWorkspace'

const BoletinesPage: FC = () => {
  const intl = useIntl()
  const {hasPermission, hasFeature} = useAuthz()
  const canCustomize = hasFeature('boletines_personalizables') && hasPermission('boletines.plantillas.gestionar')
  const breadcrumbs: Array<PageLink> = [
    {title: intl.formatMessage({id: 'academico.title'}), path: '/academico/boletines', isSeparator: false, isActive: false},
  ]

  return (
    <Routes>
      <Route element={<Content><Outlet /></Content>}>
        <Route path='gestion' element={<BulletinWorkspace />} />
        <Route path='plantillas' element={canCustomize
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
          <CatalogoView reportsOnly reportActions={<>
            {(hasPermission('boletines.observaciones.gestionar') || hasPermission('boletines.emisiones.preparar')) &&
              <Link className='btn btn-primary btn-sm' to='/academico/boletines/gestion'>
                {intl.locale.startsWith('en') ? 'Observations and report issuance' : 'Observaciones y emisión de boletines'}</Link>}
            {canCustomize && <Link className='btn btn-light-primary btn-sm' to='/academico/boletines/plantillas'>
              {intl.formatMessage({id: 'templates.openEditor'})}</Link>}
          </>} /></>} />
      </Route>
    </Routes>
  )
}

export default BoletinesPage
