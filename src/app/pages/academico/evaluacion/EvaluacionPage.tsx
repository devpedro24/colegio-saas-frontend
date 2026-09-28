import {Route, Routes, Navigate, Outlet} from 'react-router-dom'
import {PageLink, PageTitle} from '@/_metronic/layout/core'
import {useIntl} from 'react-intl'
import {CatalogoView} from './components/CatalogoView'
import {PlanillaView} from './components/PlanillaView'
import {Content} from '@/_metronic/layout/components/content'

const EvaluacionPage = () => {
  const intl = useIntl()
  const evaluacionBreadcrumbs: Array<PageLink> = [
    {title: intl.formatMessage({id: 'academico.title'}), path: '/academico/anos-lectivos', isSeparator: false, isActive: false},
  ]

  return (
    <Routes>
      <Route element={<Content><Outlet /></Content>}>
        <Route
          path='catalogo'
          element={
            <>
              <PageTitle breadcrumbs={evaluacionBreadcrumbs}>
                {intl.formatMessage({id: 'evaluacion.title'})}
              </PageTitle>
              <CatalogoView />
            </>
          }
        />
        <Route
          path='planillas/:asignacionId/:periodoId'
          element={
            <>
              <PageTitle breadcrumbs={evaluacionBreadcrumbs}>
                {intl.formatMessage({id: 'evaluacion.planilla.title'})}
              </PageTitle>
              <PlanillaView />
            </>
          }
        />
        <Route index element={<Navigate to='catalogo' replace />} />
      </Route>
    </Routes>
  )
}

export default EvaluacionPage
