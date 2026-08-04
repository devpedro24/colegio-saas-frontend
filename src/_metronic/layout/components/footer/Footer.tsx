import {useEffect} from 'react'
import {FormattedMessage} from 'react-intl'
import {ILayout, useLayout} from '../../core'

const Footer = () => {
  const {config} = useLayout()
  useEffect(() => {
    updateDOM(config)
  }, [config])
  return (
    <>
      <div className='text-gray-900 order-2 order-md-1'>
        <span className='text-gray-500 fw-semibold me-1'>
          {new Date().getFullYear().toString()}&copy;
        </span>
        <span className='text-gray-500'>
          <FormattedMessage id='footer.brand' defaultMessage='Colegio SaaS' />
        </span>
      </div>

      <ul className='menu menu-gray-500 menu-hover-primary fw-semibold order-1'>
        <li className='menu-item'>
          <a href='#' className='menu-link px-2'>
            <FormattedMessage id='footer.about' defaultMessage='Acerca de' />
          </a>
        </li>

        <li className='menu-item'>
          <a href='#' className='menu-link px-2'>
            <FormattedMessage id='footer.support' defaultMessage='Soporte' />
          </a>
        </li>

        <li className='menu-item'>
          <a href='#' className='menu-link px-2'>
            <FormattedMessage id='footer.contact' defaultMessage='Contacto' />
          </a>
        </li>
      </ul>
    </>
  )
}

const updateDOM = (config: ILayout) => {
  if (config.app?.footer?.fixed?.desktop) {
    document.body.classList.add('data-kt-app-footer-fixed', 'true')
  }

  if (config.app?.footer?.fixed?.mobile) {
    document.body.classList.add('data-kt-app-footer-fixed-mobile', 'true')
  }
}

export {Footer}
