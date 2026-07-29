import {ILayout} from './_Models'

export const DefaultConfig: ILayout = {
  layoutType: 'light-sidebar',
  main: {
    componentName: 'main',
    type: 'default',
    pageBgWhite: false,
    iconType: 'duotone',
  },
  app: {
    general: {
      componentName: 'general',
      evolution: true,
      layoutType: 'default',
      mode: 'light',
      rtl: false,
      primaryColor: '#50CD89',
      pageBgWhite: false,
      pageWidth: 'default',
    },
    header: {
      componentName: 'header',
      display: true,
      default: {
        container: 'fluid',
        containerClass: 'd-flex align-items-stretch justify-content-between',
        fixed: {
          desktop: true,
          mobile: true,
        },
        content: 'menu',
        menu: {
          display: true,
          iconType: 'svg',
        },
      },
    },
    sidebar: {
      componentName: 'sidebar',
      display: true,
      default: {
        class: 'flex-column',
        push: {
          header: false,
          toolbar: true,
          footer: true,
        },
        drawer: {
          enabled: true,
          attributes: {
            'data-kt-drawer': 'true',
            'data-kt-drawer-name': 'app-sidebar',
            'data-kt-drawer-activate': '{default: true, lg: false}',
            'data-kt-drawer-overlay': 'true',
            'data-kt-drawer-width': 'auto',
            'data-kt-drawer-direction': 'start',
            'data-kt-drawer-toggle': '#kt_app_sidebar_mobile_toggle',
          },
        },
        fixed: {
          desktop: true,
        },
        menu: {
          iconType: 'svg',
        },
      },
    },
    toolbar: {
      componentName: 'toolbar',
      display: true,
      layout: 'classic',
      class: '',
      container: 'fluid',
      containerClass: 'd-flex flex-stack flex-row-fluid',
      fixed: {
        desktop: false,
        mobile: false,
      },
      // custom settings (demo46 no usa Filter/Create en el toolbar del dashboard)
      filterButton: false,
      daterangepickerButton: false,
      primaryButton: false,
      primaryButtonLabel: 'Create',
      primaryButtonModal: 'create-app',
    },
    pageTitle: {
      componentName: 'page-title',
      display: true,
      breadCrumb: true,
      description: false,
      direction: 'column',
    },
    content: {
      componentName: 'content',
    },
    footer: {
      componentName: 'footer',
      display: true,
      container: 'fluid',
      containerClass: 'd-flex flex-column flex-md-row flex-center flex-md-stack py-3',
      fixed: {
        desktop: false,
        mobile: false,
      },
    },
    pageLoader: {
      componentName: 'page-loader',
      type: 'none',
      logoImage: 'default.svg',
      logoClass: 'mh-75px',
    },
  },
  illustrations: {
    componentName: 'illustrations',
    set: 'sketchy-1',
  },
  scrolltop: {
    componentName: 'scrolltop',
    display: true,
  },
  engage: {
    componentName: 'engage',
    demos: {
      enabled: true,
    },
    purchase: {
      enabled: false,
    },
  },
}
