
import { useEffect, useState } from 'react'
import {Outlet, Link} from 'react-router-dom'
import {FormattedMessage} from 'react-intl'
import {toAbsoluteUrl} from '../../../_metronic/helpers'
import { api } from '@/lib/api/client'

const AuthLayout = () => {
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)

  // Verifica que el tenant (subdominio) exista antes de mostrar el login.
  // Subdominios no registrados muestran pantalla en blanco.
  useEffect(() => {
    const hostname = window.location.hostname
    const isCentral = hostname === '127.0.0.1' || hostname === 'localhost'
    if (isCentral) { setLoading(false); return }
    api.get<{ok: boolean}>('/tenant-status')
      .then(() => setLoading(false))
      .catch(() => { setLoading(false); setInvalid(true) })
  }, [])

  useEffect(() => {
    const root = document.getElementById('root')
    if (root) {
      root.style.height = '100%'
    }
    return () => {
      if (root) {
        root.style.height = 'auto'
      }
    }
  }, [])

  if (loading) return null
  if (invalid) return <div style={{display: 'none'}} />

  return (
    <div className='d-flex flex-column flex-lg-row flex-column-fluid h-100'>
      {/* begin::Body */}
      <div className='d-flex flex-column flex-lg-row-fluid w-lg-50 p-10 order-2 order-lg-1'>
        {/* begin::Form */}
        <div className='d-flex flex-center flex-column flex-lg-row-fluid'>
          {/* begin::Wrapper */}
          <div className='w-lg-500px p-10'>
            <Outlet />
          </div>
          {/* end::Wrapper */}
        </div>
        {/* end::Form */}

        {/* begin::Footer */}
        <div className='d-flex flex-center flex-wrap px-5'>
          {/* begin::Links */}
          <div className='d-flex fw-semibold text-primary fs-base'>
            <a href='#' className='px-5' target='_blank'>
              <FormattedMessage id='auth.layout.terms' defaultMessage='Términos' />
            </a>

            <a href='#' className='px-5' target='_blank'>
              <FormattedMessage id='common.plans' defaultMessage='Planes' />
            </a>

            <a href='#' className='px-5' target='_blank'>
              <FormattedMessage id='auth.layout.contact' defaultMessage='Contáctanos' />
            </a>
          </div>
          {/* end::Links */}
        </div>
        {/* end::Footer */}
      </div>
      {/* end::Body */}

      {/* begin::Aside */}
      <div
        className='d-flex flex-lg-row-fluid w-lg-50 bgi-size-cover bgi-position-center order-1 order-lg-2'
        style={{backgroundImage: `url(${toAbsoluteUrl('media/misc/auth-bg.png')})`}}
      >
        {/* begin::Content */}
        <div className='d-flex flex-column flex-center py-15 px-5 px-md-15 w-100'>
          {/* begin::Logo */}
          <Link to='/' className='mb-12'>
            <span className='text-white fs-2qx fw-bold'>Colegio SaaS</span>
          </Link>
          {/* end::Logo */}

          {/* begin::Image */}
          <img
            className='mx-auto w-275px w-md-50 w-xl-500px mb-10 mb-lg-20'
            src={toAbsoluteUrl('media/misc/auth-screens.png')}
            alt=''
          />
          {/* end::Image */}

          {/* begin::Title */}
          <h1 className='text-white fs-2qx fw-bolder text-center mb-7'>
            <FormattedMessage id='auth.layout.heroTitle' defaultMessage='Rápido, eficiente y productivo' />
          </h1>
          {/* end::Title */}

          {/* begin::Text */}
          <div className='text-white fs-base text-center'>
            <FormattedMessage
              id='auth.layout.heroText'
              defaultMessage='Gestiona la vida académica y la convivencia escolar de tu colegio en una sola plataforma, simple y segura.'
            />
          </div>
          {/* end::Text */}
        </div>
        {/* end::Content */}
      </div>
      {/* end::Aside */}
    </div>
  )
}

export {AuthLayout}
