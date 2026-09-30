/* eslint-disable @typescript-eslint/no-explicit-any */
import type {AuthModel} from './_models'
import {getCsrfToken} from '@/lib/api/client'

// Solo indica que /me confirmó la sesión. La credencial real vive en cookie
// HttpOnly y nunca se copia a JavaScript ni a Web Storage.
let session: AuthModel | undefined

export const getAuth = (): AuthModel | undefined => session
export const setAuth = (auth: AuthModel): void => { session = auth }
export const removeAuth = (): void => { session = undefined }

export function setupAxios(axios: any) {
  axios.defaults.headers.Accept = 'application/json'
  axios.defaults.withCredentials = true
  axios.interceptors.request.use((config: {method?: string; headers: Record<string, string>}) => {
    if (config.method && config.method.toUpperCase() !== 'GET') {
      const csrf = getCsrfToken()
      if (csrf) config.headers['X-CSRF-Token'] = csrf
    }
    return config
  })
}
