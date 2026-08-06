import {FC, useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import {ResetPasswordDialog, type ResetPasswordGenerated} from '@/app/shared/components/ResetPasswordDialog'
import {useUserTemporalPassword, useResetUserPassword} from '../usuarios.api'
import type {Usuario} from '../usuarios.types'

type Props = {
  show: boolean
  usuario: Usuario | null
  onClose: () => void
}

const UserPasswordDialog: FC<Props> = ({show, usuario, onClose}) => {
  const intl = useIntl()
  const toast = useToast()
  const reset = useResetUserPassword()
  const [generated, setGenerated] = useState<ResetPasswordGenerated | null>(null)

  const sedeId = usuario?.tenant_id ? usuario.sede_id : null
  const {data: pwInfo, isLoading, isError} = useUserTemporalPassword(show ? usuario?.id ?? null : null, sedeId)

  useEffect(() => {
    if (!show) { setGenerated(null); reset.reset() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  const regenerate = () => {
    if (!usuario) return
    reset.mutate({id: usuario.id, sedeId}, {
      onSuccess: (data) => {
        setGenerated({email: usuario.email, password: data.password})
        toast.success(intl.formatMessage({id: 'academico.usuarios.tempPasswordGenerated'}))
      },
      onError: () => {
        toast.error(intl.formatMessage({id: 'common.toast.saveError'}))
      },
    })
  }

  return (
    <ResetPasswordDialog
      show={show}
      onClose={onClose}
      entityName={usuario?.name ?? ''}
      entityLabel={intl.formatMessage({id: 'header.menu.users'})}
      pwInfo={pwInfo ?? null}
      isLoading={isLoading}
      isError={isError}
      onRegenerate={regenerate}
      isRegenerating={reset.isPending}
      generated={generated}
      i18nPrefix='common.pwd'
    />
  )
}

export {UserPasswordDialog}
