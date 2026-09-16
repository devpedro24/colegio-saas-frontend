import {AuthModel} from './_models'
import {getToken, setToken} from '@/lib/api/client'

/**
 * El token se unifica con el api client: se guarda como cadena cruda en
 * sessionStorage bajo la key 'colegio-saas.auth-token'. Estos helpers envuelven
 * ese token en el `AuthModel` que espera la plantilla Metronic.
 */
const AUTH_SESSION_STORAGE_KEY = 'colegio-saas.auth-token'

const getAuth = (): AuthModel | undefined => {
  const token = getToken()
  return token ? {api_token: token} : undefined
}

const setAuth = (auth: AuthModel) => {
  setToken(auth.api_token, auth.expires_at)
}

const removeAuth = () => {
  setToken(null)
}

export {getAuth, setAuth, removeAuth, AUTH_SESSION_STORAGE_KEY}
