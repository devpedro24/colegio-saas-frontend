import {useState, FC} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {KTIcon} from '../../../../../../_metronic/helpers'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {useAuth} from '../../../../auth'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'
import {useDeactivateAccount} from '@/app/pages/account/account.api'

interface DeactivateFields {
  confirm: boolean
  password: string
}

// Card de "Desactivar cuenta": confirma con la contraseña y llama al backend
// (POST /account/deactivate) que pasa la cuenta a estado inactivo (bloquea el
// login). Al desactivar se cierra la sesión local.
const DeactivateAccount: FC = () => {
  const intl = useIntl()
  const toast = useToast()
  const {logout} = useAuth()

  const [loading, setLoading] = useState(false)
  const deactivateMutation = useDeactivateAccount()

  const deactivateSchema = Yup.object().shape({
    confirm: Yup.boolean().oneOf(
      [true],
      intl.formatMessage({
        id: 'account.deactivate.confirmError',
        defaultMessage: 'Confirma que deseas desactivar tu cuenta',
      }),
    ),
    password: Yup.string().required(
      intl.formatMessage({
        id: 'account.deactivate.passwordRequired',
        defaultMessage: 'Ingresa tu contraseña para confirmar',
      }),
    ),
  })

  const formik = useFormik<DeactivateFields>({
    initialValues: {
      confirm: false,
      password: '',
    },
    validationSchema: deactivateSchema,
    onSubmit: (values) => {
      setLoading(true)
      deactivateMutation.mutate(
        {password: values.password},
        {
          onSuccess: (data) => {
            toast.success(data.message ?? 'Cuenta desactivada.')
            setLoading(false)
            setTimeout(() => logout(), 900)
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              const fieldErr = err.fieldError('password')
              if (fieldErr) {
                formik.setFieldError('password', fieldErr)
              } else {
                toast.error(err.message)
              }
            } else {
              toast.error('No se pudo desactivar la cuenta.')
            }
            setLoading(false)
          },
        },
      )
    },
  })

  return (
    <div className='card'>
      <div
        className='card-header border-0 cursor-pointer'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#kt_account_deactivate'
        aria-expanded='true'
        aria-controls='kt_account_deactivate'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bold m-0'>
            <FormattedMessage id='account.deactivate.title' defaultMessage='Desactivar cuenta' />
          </h3>
        </div>
      </div>

      <div id='kt_account_deactivate' className='collapse show'>
        <form onSubmit={formik.handleSubmit} id='kt_account_deactivate_form' className='form'>
          <div className='card-body border-top p-9'>
            <div className='notice d-flex bg-light-warning rounded border-warning border border-dashed mb-9 p-6'>
              <KTIcon iconName='information-5' className='fs-2tx text-warning me-4' />

              <div className='d-flex flex-stack flex-grow-1'>
                <div className='fw-bold'>
                  <h4 className='text-gray-800 fw-bolder'>
                    <FormattedMessage
                      id='account.deactivate.noticeTitle'
                      defaultMessage='Estás desactivando tu cuenta'
                    />
                  </h4>
                  <div className='fs-6 text-gray-600'>
                    <FormattedMessage
                      id='account.deactivate.noticeBody'
                      defaultMessage='Perderás el acceso hasta que un administrador la reactive. Esta acción no borra tus datos.'
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className='fv-row mb-6'>
              <label htmlFor='deactivate-password' className='form-label fs-6 fw-bolder mb-3'>
                <FormattedMessage id='account.field.password' defaultMessage='Contraseña' />
              </label>
              <input
                type='password'
                id='deactivate-password'
                className='form-control form-control-lg form-control-solid'
                placeholder={intl.formatMessage({
                  id: 'account.deactivate.passwordPh',
                  defaultMessage: 'Ingresa tu contraseña',
                })}
                {...formik.getFieldProps('password')}
              />
              {formik.touched.password && formik.errors.password && (
                <div className='fv-plugins-message-container'>
                  <div className='fv-help-block'>{formik.errors.password}</div>
                </div>
              )}
            </div>

            <div className='form-check form-check-solid fv-row'>
              <input
                className='form-check-input'
                type='checkbox'
                {...formik.getFieldProps('confirm')}
              />
              <label className='form-check-label fw-bold ps-2 fs-6'>
                <FormattedMessage
                  id='account.deactivate.confirm'
                  defaultMessage='Confirmo la desactivación de mi cuenta'
                />
              </label>
              {formik.touched.confirm && formik.errors.confirm && (
                <div className='fv-plugins-message-container'>
                  <div className='fv-help-block'>{formik.errors.confirm}</div>
                </div>
              )}
            </div>
          </div>

          <div className='card-footer d-flex justify-content-end py-6 px-9'>
            <button
              id='kt_account_deactivate_account_submit'
              type='submit'
              className='btn btn-danger fw-bold'
              disabled={loading}
            >
              {!loading && (
                <FormattedMessage id='account.deactivate.title' defaultMessage='Desactivar cuenta' />
              )}
              {loading && (
                <span className='indicator-progress' style={{display: 'block'}}>
                  <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />{' '}
                  <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export {DeactivateAccount}