import {useEffect, useState, type ReactNode} from 'react'
import {Outlet} from 'react-router-dom'
import {api} from '@/lib/api/client'
import {AuthScreen} from './AuthScreen'

const AuthLayout = ({children}: {children?: ReactNode} = {}) => {
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [loginImage, setLoginImage] = useState<string | null>(null)
  const hostname = window.location.hostname
  const isCentral = hostname === '127.0.0.1' || hostname === 'localhost'

  useEffect(() => {
    let active = true
    if (isCentral) { setLoading(false); return }
    api.get<{ok: boolean}>('/tenant-status')
      .then(() => { if (active) setLoading(false) })
      .catch(() => { if (active) { setLoading(false); setInvalid(true) } })
    return () => { active = false }
  }, [isCentral])

  useEffect(() => {
    let active = true
    api.get<{image_url: string | null}>('/branding/login')
      .then(data => { if (active) setLoginImage(data.image_url) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const root = document.getElementById('root')
    if (root) root.style.height = '100%'
    return () => { if (root) root.style.height = 'auto' }
  }, [])

  if (loading) return null
  if (invalid) return <div style={{display: 'none'}} />

  return <AuthScreen imageUrl={loginImage} isPlatform={isCentral}>{children ?? <Outlet />}</AuthScreen>
}

export {AuthLayout}
