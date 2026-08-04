import {useEffect} from 'react'
import {Outlet, useLocation} from 'react-router-dom'
import {HeaderWrapper, UpgradePlanModal} from './components/header'
import {ScrollTop} from './components/scroll-top'
import {FooterWrapper} from './components/footer'
import {Sidebar} from './components/sidebar'
import {ActivityDrawer, DrawerMessenger, InviteUsers} from '../partials'
import {PageDataProvider} from './core'
import {reInitMenu} from '../helpers'
import {ImpersonationBanner} from '../../app/modules/impersonation/ImpersonationBanner'

const MasterLayout = () => {
  const location = useLocation()
  useEffect(() => {
    reInitMenu()
  }, [location.key])

  return (
    <PageDataProvider>
      {/* begin::App */}
      <div className='d-flex flex-column flex-root app-root' id='kt_app_root'>
        {/* begin::Page */}
        <div className='app-page flex-column flex-column-fluid' id='kt_app_page'>
          <HeaderWrapper />
          {/* begin::Wrapper */}
          <div className='app-wrapper d-flex' id='kt_app_wrapper'>
            {/* begin::Wrapper container */}
            <div className='app-container container-fluid'>
              <Sidebar />
              {/* begin::Main */}
              <div className='app-main flex-column flex-row-fluid' id='kt_app_main'>
                {/* Banner de suplantación: sólo visible cuando hay un colegio activo. Va ARRIBA
                    del contenido principal, dentro del área de contenido. */}
                <ImpersonationBanner />
                {/* begin::Content wrapper */}
                <div className='d-flex flex-column flex-column-fluid'>
                  <Outlet />
                </div>
                {/* end::Content wrapper */}
                <FooterWrapper />
              </div>
              {/* end::Main */}
            </div>
            {/* end::Wrapper container */}
          </div>
          {/* end::Wrapper */}
        </div>
        {/* end::Page */}
      </div>
      {/* end::App */}

      {/* begin:: Drawers (kt_activities y kt_drawer_chat existen en demo46) */}
      <ActivityDrawer />
      <DrawerMessenger />
      {/* end:: Drawers */}

      {/* begin:: Modals (demo46: kt_modal_upgrade_plan + kt_modal_invite_friends) */}
      <InviteUsers />
      <UpgradePlanModal />
      {/* end:: Modals */}
      <ScrollTop />
    </PageDataProvider>
  )
}

export {MasterLayout}
