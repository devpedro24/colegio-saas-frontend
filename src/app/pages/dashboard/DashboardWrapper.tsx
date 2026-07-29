import {FC, useEffect} from 'react'
import {Tab} from 'bootstrap'
import {reInitMenu, withBase} from '../../../_metronic/helpers'
import {PageLink, PageTitle} from '../../../_metronic/layout/core'
import {ToolbarWrapper} from '../../../_metronic/layout/components/toolbar'
import {Content} from '../../../_metronic/layout/components/content'
import {DASHBOARD_HTML} from './_DashboardContent'
import {initDashboardCharts} from './_dashboardCharts'
import type ApexCharts from 'apexcharts'

const dashboardBreadcrumbs: Array<PageLink> = [
  {title: 'Dashboards', path: '/dashboard', isSeparator: false, isActive: false},
]

const DashboardPage: FC = () => {
  useEffect(() => {
    let charts: ApexCharts[] = []
    let tabEls: Element[] = []
    const onShown = () => window.dispatchEvent(new Event('resize'))

    // Pequeño delay para que el layout (header fijo, contenedores) tenga anchos ya calculados.
    const timer = window.setTimeout(() => {
      charts = initDashboardCharts()

      // Inicializa tabs y pills de Bootstrap presentes en el HTML inyectado.
      tabEls = Array.from(
        document.querySelectorAll('[data-bs-toggle="tab"], [data-bs-toggle="pill"]')
      )
      tabEls.forEach((el) => {
        try {
          Tab.getOrCreateInstance(el)
        } catch (e) {
          /* noop */
        }
        el.addEventListener('shown.bs.tab', onShown)
      })

      // Re-inicializa menús/dropdowns (data-kt-menu) del contenido inyectado.
      reInitMenu()
    }, 300)

    return () => {
      window.clearTimeout(timer)
      charts.forEach((c) => {
        try {
          c.destroy()
        } catch (e) {
          /* noop */
        }
      })
      tabEls.forEach((el) => el.removeEventListener('shown.bs.tab', onShown))
    }
  }, [])

  return (
    <>
      <ToolbarWrapper />
      <Content>
        <div dangerouslySetInnerHTML={{__html: withBase(DASHBOARD_HTML)}} />
      </Content>
    </>
  )
}

const DashboardWrapper: FC = () => {
  // El toolbar lo renderiza ToolbarWrapper leyendo del contexto PageData. Fijamos aqui el
  // titulo ("eCommerce Dashboard") y el breadcrumb (Home > Dashboards).
  return (
    <>
      <PageTitle breadcrumbs={dashboardBreadcrumbs}>eCommerce Dashboard</PageTitle>
      <DashboardPage />
    </>
  )
}

export {DashboardWrapper}
