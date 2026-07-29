import {useLayout} from '../../core'
import {Footer} from './Footer'

const FooterWrapper = () => {
  const {config} = useLayout()
  if (!config.app?.footer?.display) {
    return null
  }

  return (
    <div
      id='kt_app_footer'
      className='app-footer d-flex flex-column flex-md-row align-items-center flex-center flex-md-stack'
    >
      <Footer />
    </div>
  )
}

export {FooterWrapper}
