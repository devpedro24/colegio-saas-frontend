import {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {useNavigate} from 'react-router-dom'
import {useAuth} from './core/Auth'

export function Logout() {
  const {logout} = useAuth()
  const navigate = useNavigate()
  const intl = useIntl()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void logout()
      .then(() => {if (active) navigate('/auth/login', {replace: true})})
      .catch(() => {if (active) setError(intl.formatMessage({id: 'common.toast.genericError'}))})
    return () => {active = false}
  }, [logout, navigate, intl])

  return error ? <div className='alert alert-danger' role='alert'>{error}</div> : null
}
