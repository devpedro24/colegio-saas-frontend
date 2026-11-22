import {useState, type ReactNode} from 'react'
import {Link} from 'react-router-dom'
import {FormattedMessage} from 'react-intl'
import {toAbsoluteUrl} from '../../../_metronic/helpers'
import './AuthScreen.css'

type Props = {children: ReactNode; imageUrl: string | null; isPlatform: boolean}

/** Shared by the public login and the unsaved appearance preview. */
export function AuthScreen({children, imageUrl, isPlatform}: Props) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const custom = !!imageUrl && failedImage !== imageUrl

  return <div className='auth-screen d-flex flex-column flex-lg-row flex-column-fluid'>
    <div className='d-flex flex-column flex-lg-row-fluid w-lg-50 p-5 p-md-10 order-2 order-lg-1'>
      <div className='d-flex flex-center flex-column flex-lg-row-fluid'>
        <div className='auth-screen__form w-lg-500px p-5 p-md-10'>{children}</div>
      </div>
      <footer className='w-100 pt-6'>
        <div className='d-flex flex-center flex-wrap px-5'>
          <div className='d-flex flex-wrap justify-content-center fw-semibold text-primary fs-base'>
            <a href='#' className='px-5' target='_blank'><FormattedMessage id='auth.layout.terms' /></a>
            <a href='#' className='px-5' target='_blank'><FormattedMessage id='common.plans' /></a>
            <a href='#' className='px-5' target='_blank'><FormattedMessage id='auth.layout.contact' /></a>
          </div>
        </div>
        {isPlatform && <p className='text-start text-gray-500 fs-8 lh-lg mt-6 mb-0'>
          <FormattedMessage id='auth.layout.copyright' values={{year: new Date().getFullYear()}} /><br />
          <FormattedMessage id='auth.layout.developedBy' values={{developer: 'GirGit Software'}} />
        </p>}
      </footer>
    </div>
    <aside data-testid='login-visual-panel'
      className={`auth-screen__aside d-flex flex-lg-row-fluid w-lg-50 order-1 order-lg-2${custom ? ' auth-screen__aside--custom' : ''}`}
      style={custom ? undefined : {backgroundImage: `url(${toAbsoluteUrl('media/misc/auth-bg.png')})`}}>
      {custom && <>
        <img data-testid='login-background-image' className='auth-screen__background' src={imageUrl!}
          onError={() => setFailedImage(imageUrl)} alt='' />
        <div className='auth-screen__shade' aria-hidden='true' />
      </>}
      <div className={`auth-screen__aside-content d-flex flex-column align-items-center py-15 px-5 px-md-15 w-100 ${custom ? 'justify-content-between' : 'justify-content-center'}`}>
        <Link to='/' className='mb-12 text-center'>
          <span className='text-white fs-2qx fw-bold'>Plataforma Educativa - GirCampus</span>
        </Link>
        {!custom && <img className='mx-auto w-275px w-md-50 w-xl-500px mb-10 mb-lg-20'
          src={toAbsoluteUrl('media/misc/auth-screens.png')} alt='' style={{maxHeight: 420, objectFit: 'contain'}} />}
        <div>
          <h1 className='text-white fs-2qx fw-bolder text-center mb-7'><FormattedMessage id='auth.layout.heroTitle' /></h1>
          <div className='text-white fs-base text-center'><FormattedMessage id='auth.layout.heroText' /></div>
        </div>
      </div>
    </aside>
  </div>
}
