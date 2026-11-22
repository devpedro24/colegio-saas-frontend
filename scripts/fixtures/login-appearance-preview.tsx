// Isolated presentation fixture. No AuthInit, account credentials or real backend.
import {createRoot} from 'react-dom/client'
import {MemoryRouter} from 'react-router-dom'
import {IntlProvider} from 'react-intl'
import {QueryClientProvider} from '@tanstack/react-query'
import messages from '../../src/_metronic/i18n/messages/es.json'
import {queryClient} from '../../src/lib/api/query-client'
import {ToastProvider} from '../../src/lib/ui/toast'
import {AuthProvider} from '../../src/app/modules/auth/core/Auth'
import {AuthScreen} from '../../src/app/modules/auth/AuthScreen'
import {Login} from '../../src/app/modules/auth/components/Login'
import {LoginAppearanceCard} from '../../src/app/shared/components/LoginAppearanceCard'
import '../../src/_metronic/assets/sass/style.react.scss'
import '../../src/_metronic/assets/sass/style.scss'
import '../../src/_metronic/assets/keenicons/solid/style.css'

const params = new URLSearchParams(location.search)
const isPlatform = params.get('scope') !== 'school'
const endpoint = isPlatform ? '/platform/login-appearance' : '/colegios/smoke-school/login-appearance'
const imageUrl = params.get('image') === 'default' ? null : '/media/stock/600x400/img-9.jpg'

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <IntlProvider locale='es' messages={messages}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter>
            {params.get('mode') === 'screen'
              ? <div style={{height: '100vh'}}><AuthScreen imageUrl={imageUrl} isPlatform={isPlatform}>
                <Login showEnrollmentEntry={!isPlatform} />
              </AuthScreen></div>
              : <main className='container-fluid py-8' style={{maxWidth: 1100}}>
                <LoginAppearanceCard endpoint={endpoint} />
              </main>}
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </IntlProvider>
  </QueryClientProvider>
)
