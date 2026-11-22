import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {IntlProvider} from 'react-intl'
import messages from '../../src/_metronic/i18n/messages/es.json'
import {AuthScreen} from '../../src/app/modules/auth/AuthScreen'
import {ForgotPassword} from '../../src/app/modules/auth/components/ForgotPassword'
import {ResetPassword} from '../../src/app/modules/auth/components/ResetPassword'
import '../../src/_metronic/assets/sass/style.react.scss'
import '../../src/_metronic/assets/sass/style.scss'
import '../../src/_metronic/assets/keenicons/solid/style.css'

const reset = new URLSearchParams(location.search).has('reset')
createRoot(document.getElementById('root')!).render(
  <IntlProvider locale='es' messages={messages}>
    <MemoryRouter initialEntries={reset ? ['/auth/reset-password?token=synthetic-link-token&email=rector@example.test'] : ['/auth/forgot-password']}>
      <AuthScreen imageUrl={null} isPlatform>
        {reset ? <ResetPassword /> : <ForgotPassword />}
      </AuthScreen>
    </MemoryRouter>
  </IntlProvider>
)
