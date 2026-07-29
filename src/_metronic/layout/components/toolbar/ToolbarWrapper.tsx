import {Fragment} from 'react'
import {Link} from 'react-router-dom'
import {useLayout, usePageData} from '../../core'

// Toolbar dinamico con la ESTRUCTURA del toolbar de demo46 (breadcrumb con icono home
// ki-home + separadores ki-right + items, y h1.page-heading). Lee pageTitle/pageBreadcrumbs
// del contexto PageData; cada pagina fija su PageTitle. Sin acciones History/Invite.
const ToolbarWrapper = () => {
  const {config} = useLayout()
  const {pageTitle, pageBreadcrumbs} = usePageData()

  if (!config.app?.toolbar?.display) {
    return null
  }

  const crumbs = (pageBreadcrumbs || []).filter((b) => !b.isSeparator && b.title)

  return (
    <div id='kt_app_toolbar' className='app-toolbar'>
      {/* begin::Toolbar container */}
      <div className='d-flex flex-stack flex-row-fluid'>
        {/* begin::Toolbar wrapper */}
        <div className='d-flex flex-column flex-row-fluid'>
          {/* begin::Breadcrumb */}
          <ul className='breadcrumb breadcrumb-separatorless fw-semibold mb-3'>
            {/* begin::Home */}
            <li className='breadcrumb-item text-gray-600 fw-bold lh-1'>
              <Link to='/dashboard' className='text-white text-hover-primary'>
                <i className='ki-duotone ki-home text-gray-500 fs-2'></i>
              </Link>
            </li>
            {/* end::Home */}
            {crumbs.map((item, index) => (
              <Fragment key={`${item.path}-${index}`}>
                {/* begin::Separator */}
                <li className='breadcrumb-item'>
                  <i className='ki-duotone ki-right fs-3 text-gray-500 mx-n1'></i>
                </li>
                {/* end::Separator */}
                {/* begin::Item */}
                <li className='breadcrumb-item text-gray-600 fw-bold lh-1'>
                  {item.path ? (
                    <Link to={item.path} className='text-gray-600 text-hover-primary'>
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </li>
                {/* end::Item */}
              </Fragment>
            ))}
          </ul>
          {/* end::Breadcrumb */}
          {/* begin::Page title */}
          <div className='page-title d-flex align-items-center me-3'>
            <h1 className='page-heading d-flex text-gray-900 fw-bolder fs-1 flex-column justify-content-center my-0'>
              {pageTitle}
            </h1>
          </div>
          {/* end::Page title */}
        </div>
        {/* end::Toolbar wrapper */}
      </div>
      {/* end::Toolbar container */}
    </div>
  )
}

export {ToolbarWrapper}
