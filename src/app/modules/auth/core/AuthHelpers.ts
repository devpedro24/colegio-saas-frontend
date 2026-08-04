/* eslint-disable @typescript-eslint/no-explicit-any */
import {AuthModel} from './_models'
import {getToken, setToken} from '@/lib/api/client'

/**
 * El token se unifica con el api client: se guarda como cadena cruda en
 * localStorage bajo la key 'colegio-saas.auth-token'. Estos helpers envuelven
 * ese token en el `AuthModel` que espera la plantilla Metronic.
 */
const AUTH_LOCAL_STORAGE_KEY = 'colegio-saas.auth-token'

const getAuth = (): AuthModel | undefined => {
  const token = getToken()
  return token ? {api_token: token} : undefined
}

const setAuth = (auth: AuthModel) => {
  setToken(auth.api_token)
}

const removeAuth = () => {
  setToken(null)
}

export function setupAxios(axios: any) {
  axios.defaults.headers.Accept = 'application/json'
  axios.interceptors.request.use(
    (config: {headers: {Authorization: string}}) => {
      const token = getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      return config
    },
    (err: any) => Promise.reject(err)
  )
}

export {getAuth, setAuth, removeAuth, AUTH_LOCAL_STORAGE_KEY}
