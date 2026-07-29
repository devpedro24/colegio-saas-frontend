/* eslint-disable no-prototype-builtins */
import {FC, useEffect} from 'react'
import {ILayout, useLayout} from '../../core'
import {withBase} from '../../../helpers'
import {HEADER_MENU_HTML} from './_HeaderMenuContent'

// Menu #kt_app_header_menu portado literal de demo46 (Home / Pages / Apps / Help con
// mega-menus por hover). El comportamiento hover lo maneja KTMenu (data-kt-menu-trigger).
const Header: FC = () => {
  const {config} = useLayout()
  useEffect(() => {
    updateDOM(config)
  }, [config])

  return (
    <div
      className='menu menu-rounded menu-active-bg menu-state-primary menu-column menu-lg-row menu-title-gray-700 menu-icon-gray-500 menu-arrow-gray-500 menu-bullet-gray-500 my-5 my-lg-0 align-items-stretch fw-semibold px-2 px-lg-0'
      id='kt_app_header_menu'
      data-kt-menu='true'
      dangerouslySetInnerHTML={{__html: withBase(HEADER_MENU_HTML)}}
    />
  )
}

const updateDOM = (config: ILayout) => {
  if (config.app?.header?.default?.fixed?.desktop) {
    document.body.setAttribute('data-kt-app-header-fixed', 'true')
  }

  if (config.app?.header?.default?.fixed?.mobile) {
    document.body.setAttribute('data-kt-app-header-fixed-mobile', 'true')
  }

  if (config.app?.header?.default?.stacked) {
    document.body.setAttribute('data-kt-app-header-stacked', 'true')
  }
}

export {Header}
