/* eslint-disable react-refresh/only-export-components */
import {FC, useState, useEffect, createContext, useContext, Dispatch, SetStateAction} from 'react'
import {LayoutSplashScreen} from '../../../../_metronic/layout/core'
import type {AuthModel, UserModel} from './_models'
import * as authHelper from './AuthHelpers'
import {getCurrentUser, logout as requestLogout} from './_requests'
import {getImpersonationStatus} from '../../impersonation/impersonation.api'
import {clearImpersonation, setActiveColegio} from '../../impersonation/impersonation.store'
import {advanceSessionGeneration, onSessionExpired, ApiError} from '@/lib/api/client'
import type {WithChildren} from '../../../../_metronic/helpers'

type AuthContextProps = {
  auth: AuthModel | undefined
  saveAuth: (auth: AuthModel | undefined) => void
  currentUser: UserModel | undefined
  setCurrentUser: Dispatch<SetStateAction<UserModel | undefined>>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextProps>({
  auth: undefined,
  saveAuth: () => {},
  currentUser: undefined,
  setCurrentUser: () => {},
  logout: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: FC<WithChildren> = ({children}) => {
  const [auth, setAuth] = useState<AuthModel | undefined>()
  const [currentUser, setCurrentUser] = useState<UserModel | undefined>()

  const saveAuth = (next: AuthModel | undefined) => {
    if (next) authHelper.setAuth(next)
    else authHelper.removeAuth()
    advanceSessionGeneration()
    setAuth(next)
  }

  useEffect(() => onSessionExpired(() => {
    authHelper.removeAuth()
    advanceSessionGeneration()
    setAuth(undefined)
    setCurrentUser(undefined)
    clearImpersonation()
  }), [])

  const logout = async () => {
    try { await requestLogout() }
    catch (error) {
      // Un 401 confirma que la sesión ya expiró. Ante un error de red, la
      // cookie puede seguir vigente: conservar la pantalla permite reintentar.
      if (!(error instanceof ApiError && error.status === 401)) throw error
    }
    saveAuth(undefined)
    setCurrentUser(undefined)
    clearImpersonation()
  }

  return <AuthContext.Provider value={{auth, saveAuth, currentUser, setCurrentUser, logout}}>{children}</AuthContext.Provider>
}

export const AuthInit: FC<WithChildren> = ({children}) => {
  const {saveAuth, setCurrentUser} = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let disposed = false
    const rehydrate = async () => {
      try {
        const {data: user} = await getCurrentUser()
        if (disposed) return
        if (user.is_platform) {
          const {data} = await getImpersonationStatus()
          if (disposed) return
          if (data.colegio) setActiveColegio(data.colegio)
          else clearImpersonation()
        } else clearImpersonation()
        if (!disposed) {
          saveAuth({authenticated: true})
          setCurrentUser(user)
        }
      } catch {
        if (!disposed) {
          saveAuth(undefined)
          setCurrentUser(undefined)
          clearImpersonation()
        }
      } finally {
        if (!disposed) setReady(true)
      }
    }
    void rehydrate()
    return () => { disposed = true }
    // Session bootstrap runs once per tab. Subsequent state changes use the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ready ? <>{children}</> : <LayoutSplashScreen />
}
