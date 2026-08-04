import {useEffect} from 'react'
import {useSearchParams} from 'react-router-dom'
import {ProfileDetails} from './cards/ProfileDetails'
import {SignInMethod} from './cards/SignInMethod'
import {TwoFactorAuth} from './cards/TwoFactorAuth'
import {ConnectedAccounts} from './cards/ConnectedAccounts'
import {EmailPreferences} from './cards/EmailPreferences'
import {Notifications} from './cards/Notifications'
import {DeactivateAccount} from './cards/DeactivateAccount'
import {useAuth} from '../../../auth'
import {getUserByToken} from '../../../auth/core/_requests'
import {useToast} from '@/lib/ui/toast'

// Sin <Content> propio: AccountPage ya envuelve header + child en un solo Content.
// Al volver de la vinculación de Google (callback del backend redirige a
// /account/settings?google=linked|error) se refresca el usuario de la sesión
// para mostrar el correo vinculado y se avisa con un toast.
export function Settings() {
  const toast = useToast()
  const {setCurrentUser} = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const status = searchParams.get('google')

    if (!status) {
      return
    }

    setSearchParams({}, {replace: true})

    if (status === 'linked') {
      toast.success('Cuenta de Google vinculada correctamente.')
    } else if (status === 'error') {
      toast.error('No se pudo vincular la cuenta de Google.')
    }

    getUserByToken('')
      .then(({data}) => setCurrentUser(data))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <>
      <ProfileDetails />
      <SignInMethod />
      <TwoFactorAuth />
      <ConnectedAccounts />
      <EmailPreferences />
      <Notifications />
      <DeactivateAccount />
    </>
  )
}