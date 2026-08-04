import React from 'react'
import {Navigate, Route, Routes, Outlet} from 'react-router-dom'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '../../../_metronic/layout/core'
import {ToolbarWrapper} from '../../../_metronic/layout/components/toolbar'
import {Content} from '../../../_metronic/layout/components/content'
import {Overview} from './components/Overview'
import {Settings} from './components/settings/Settings'
import {AccountHeader} from './AccountHeader'

const AccountPage: React.FC = () => {
  const intl = useIntl()
  const accountBreadCrumbs: Array<PageLink> = [
    {
      title: intl.formatMessage({id: 'account.breadcrumb', defaultMessage: 'Cuenta'}),
      path: '/account/overview',
      isSeparator: false,
      isActive: false,
    },
  ]

  return (
    <Routes>
      <Route
        element={
          <>
            {/* Un solo toolbar + un solo Content que envuelve header + child (evita doble padding). */}
            <ToolbarWrapper />
            <Content>
              <AccountHeader />
              <Outlet />
            </Content>
          </>
        }
      >
        <Route
          path='overview'
          element={
            <>
              <PageTitle breadcrumbs={accountBreadCrumbs}>
                {intl.formatMessage({id: 'account.tab.overview', defaultMessage: 'Resumen'})}
              </PageTitle>
              <Overview />
            </>
          }
        />
        <Route
          path='settings'
          element={
            <>
              <PageTitle breadcrumbs={accountBreadCrumbs}>
                {intl.formatMessage({id: 'account.tab.settings', defaultMessage: 'Configuración'})}
              </PageTitle>
              <Settings />
            </>
          }
        />
        <Route index element={<Navigate to='/account/overview' />} />
      </Route>
    </Routes>
  )
}

export default AccountPage
