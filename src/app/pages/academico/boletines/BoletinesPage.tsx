import {useCommercialText} from '../../config/planes/useCommercialText'
import {FC} from 'react'
import {Route, Routes, Outlet, Link, Navigate} from 'react-router-dom'
import {PageLink, PageTitle} from '@/_metronic/layout/core'
import {useIntl} from 'react-intl'
import {BoletinView} from './components/BoletinView'
import {CatalogoView} from '../evaluacion/components/CatalogoView'
import {Content} from '@/_metronic/layout/components/content'
import {useAuthz} from '@/app/modules/auth/core/authz'
import PresetTemplatesPage from './PresetTemplatesPage'
import PlantillasPage from './PlantillasPage'
import BulletinWorkspace from './BulletinWorkspace'
import './boletines.css'

const BoletinesPage: FC = () => {
  const intl = useIntl(), t = useCommercialText()
  const {hasPermission, hasFeature} = useAuthz()
  const canCustomize = hasFeature('boletines_personalizables') && hasPermission('boletines.plantillas.gestionar')
  const canPresets = hasFeature('boletines_predefinidos') && hasPermission('boletines.emisiones.preparar')
  const breadcrumbs: Array<PageLink> = [
    {title: intl.formatMessage({id: 'academico.title'}), path: '/academico/boletines', isSeparator: false, isActive: false},
  ]

  return (
    <Routes>
      <Route path='plantillas' element={canCustomize
        ? <><PageTitle breadcrumbs={breadcrumbs}>{intl.formatMessage({id: 'templates.title'})}</PageTitle><PlantillasPage /></>
        : canPresets ? <PresetTemplatesPage /> : <Navigate to='/academico/boletines' replace />} />
      <Route element={<Content><Outlet /></Content>}>
        <Route path='gestion' element={<BulletinWorkspace />} />
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
          <CatalogoView reportsOnly reportActions={({year, group}) => <>
            {(hasPermission('boletines.observaciones.gestionar') || hasPermission('boletines.emisiones.preparar')) &&
              <Link className='btn btn-light-primary btn-sm bulletin-catalog-action' to={`/academico/boletines/gestion?${new URLSearchParams({ano: year, ...(group ? {grupo: group} : {})})}`}>
                {intl.formatMessage({id: 'boletines.workspace.title'})}</Link>}
            {(canCustomize || canPresets) && <Link className='btn btn-light-primary btn-sm bulletin-catalog-action' to='/academico/boletines/plantillas'>
              {t(canCustomize ? 'templates.openEditor' : 'commercial.presets')}</Link>}
          </>} /></>} />
      </Route>
    </Routes>
  )
}

export default BoletinesPage
