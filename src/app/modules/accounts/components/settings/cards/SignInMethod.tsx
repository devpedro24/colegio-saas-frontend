import {useState, FC} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {KTIcon} from '../../../../../../_metronic/helpers'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {useAuth} from '../../../../auth'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'
import {useChangeEmail, useChangePassword} from '@/app/pages/account/account.api'

interface EmailForm {
  newEmail: string
  confirmPassword: string
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  passwordConfirmation: string
}

// Card de "Método de inicio de sesión": cambiar CORREO y CONTRASEÑA reales
// (POST /account/email y /account/password). La promoción de verificación en
// dos pasos solo se muestra a usuarios de PLATAFORMA (superadmin): los usuarios
// de colegio la ven resuelta en la card propia de MFA.
const SignInMethod: FC = () => {
  const intl = useIntl()
  const toast = useToast()
  const {currentUser, setCurrentUser} = useAuth()

  const isPlatform = currentUser?.is_platform === true

  const [showEmailForm, setShowEmailForm] = useState<boolean>(false)
  const [showPasswordForm, setPasswordForm] = useState<boolean>(false)

  const [loading1, setLoading1] = useState(false)
  const [loading2, setLoading2] = useState(false)

  const emailMutation = useChangeEmail()
  const passwordMutation = useChangePassword()

  const emailSchema = Yup.object().shape({
    newEmail: Yup.string().email('Formato de correo inválido').max(190, 'Máximo 190 caracteres').required('El correo es obligatorio'),
    confirmPassword: Yup.string().required('La contraseña es obligatoria'),
  })

  const passwordSchema = Yup.object().shape({
    currentPassword: Yup.string().required('La contraseña actual es obligatoria'),
    newPassword: Yup.string()
      .min(8, 'Mínimo 8 caracteres')
      .required('La nueva contraseña es obligatoria'),
    passwordConfirmation: Yup.string()
      .required('Confirma la nueva contraseña')
      .oneOf([Yup.ref('newPassword')], 'Las contraseñas no coinciden'),
  })

  const formik1 = useFormik<EmailForm>({
    initialValues: {newEmail: currentUser?.email ?? '', confirmPassword: ''},
    validationSchema: emailSchema,
    onSubmit: (values) => {
      setLoading1(true)
      emailMutation.mutate(
        {email: values.newEmail.trim(), password: values.confirmPassword},
        {
          onSuccess: (data) => {
            const user = data.user
            if (user) {
              setCurrentUser((prev) => (prev ? {...prev, email: user.email} : prev))
            }
            toast.success(data.message ?? 'Correo actualizado.')
            setLoading1(false)
            setShowEmailForm(false)
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              const emailErr = err.fieldError('email')
              const passErr = err.fieldError('password')
              if (emailErr) formik1.setFieldError('newEmail', emailErr)
              if (passErr) formik1.setFieldError('confirmPassword', passErr)
              if (!emailErr && !passErr) toast.error(err.message)
            } else {
              toast.error('No se pudo actualizar el correo.')
            }
            setLoading1(false)
          },
        },
      )
    },
  })

  const formik2 = useFormik<PasswordForm>({
    initialValues: {currentPassword: '', newPassword: '', passwordConfirmation: ''},
    validationSchema: passwordSchema,
    onSubmit: (values) => {
      setLoading2(true)
      passwordMutation.mutate(
        {
          current_password: values.currentPassword,
          new_password: values.newPassword,
          new_password_confirmation: values.passwordConfirmation,
        },
        {
          onSuccess: (data) => {
            toast.success(data.message ?? 'Contraseña actualizada.')
            setLoading2(false)
            setPasswordForm(false)
            formik2.resetForm()
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              const currentErr = err.fieldError('current_password')
              if (currentErr) formik2.setFieldError('currentPassword', currentErr)
              const newErr = err.fieldError('new_password')
              if (newErr) formik2.setFieldError('newPassword', newErr)
              if (!currentErr && !newErr) toast.error(err.message)
            } else {
              toast.error('No se pudo actualizar la contraseña.')
            }
            setLoading2(false)
          },
        },
      )
    },
  })

  return (
    <div className='card mb-5 mb-xl-10'>
      <div
        className='card-header border-0 cursor-pointer'
        role='button'
        data-bs-toggle='collapse'
        data-bs-target='#kt_account_signin_method'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bold m-0'>
            <FormattedMessage id='account.signin.title' defaultMessage='Método de inicio de sesión' />
          </h3>
        </div>
      </div>

      <div id='kt_account_signin_method' className='collapse show'>
        <div className='card-body border-top p-9'>
          <div className='d-flex flex-wrap align-items-center'>
            <div id='kt_signin_email' className={' ' + (showEmailForm && 'd-none')}>
              <div className='fs-6 fw-bolder mb-1'>
                <FormattedMessage id='common.email' defaultMessage='Correo electrónico' />
              </div>
              <div className='fw-bold text-gray-600'>{currentUser?.email ?? '—'}</div>
            </div>

            <div
              id='kt_signin_email_edit'
              className={'flex-row-fluid ' + (!showEmailForm && 'd-none')}
            >
              <form
                onSubmit={formik1.handleSubmit}
                id='kt_signin_change_email'
                className='form'
                noValidate
              >
                <div className='row mb-6'>
                  <div className='col-lg-6 mb-4 mb-lg-0'>
                    <div className='fv-row mb-0'>
                      <label htmlFor='emailaddress' className='form-label fs-6 fw-bolder mb-3'>
                        <FormattedMessage
                          id='account.signin.enterNewEmail'
                          defaultMessage='Ingresa el nuevo correo electrónico'
                        />
                      </label>
                      <input
                        type='email'
                        className='form-control form-control-lg form-control-solid'
                        id='emailaddress'
                        placeholder={intl.formatMessage({
                          id: 'common.email',
                          defaultMessage: 'Correo electrónico',
                        })}
                        {...formik1.getFieldProps('newEmail')}
                      />
                      {formik1.touched.newEmail && formik1.errors.newEmail && (
                        <div className='fv-plugins-message-container'>
                          <div className='fv-help-block'>{formik1.errors.newEmail}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='col-lg-6'>
                    <div className='fv-row mb-0'>
                      <label
                        htmlFor='confirmemailpassword'
                        className='form-label fs-6 fw-bolder mb-3'
                      >
                        <FormattedMessage
                          id='account.signin.confirmPassword'
                          defaultMessage='Confirma la contraseña'
                        />
                      </label>
                      <input
                        type='password'
                        className='form-control form-control-lg form-control-solid'
                        id='confirmemailpassword'
                        {...formik1.getFieldProps('confirmPassword')}
                      />
                      {formik1.touched.confirmPassword && formik1.errors.confirmPassword && (
                        <div className='fv-plugins-message-container'>
                          <div className='fv-help-block'>{formik1.errors.confirmPassword}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className='d-flex'>
                  <button
                    id='kt_signin_submit'
                    type='submit'
                    className='btn btn-primary me-2 px-6'
                    disabled={loading1}
                  >
                    {!loading1 && (
                      <FormattedMessage id='account.signin.updateEmail' defaultMessage='Actualizar correo' />
                    )}
                    {loading1 && (
                      <span className='indicator-progress' style={{display: 'block'}}>
                        <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />{' '}
                        <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                      </span>
                    )}
                  </button>
                  <button
                    id='kt_signin_cancel'
                    type='button'
                    onClick={() => {
                      setShowEmailForm(false)
                    }}
                    className='btn btn-color-gray-500 btn-active-light-primary px-6'
                  >
                    <FormattedMessage id='common.cancel' defaultMessage='Cancelar' />
                  </button>
                </div>
              </form>
            </div>

            <div id='kt_signin_email_button' className={'ms-auto ' + (showEmailForm && 'd-none')}>
              <button
                onClick={() => {
                  setShowEmailForm(true)
                }}
                className='btn btn-light btn-active-light-primary'
              >
                <FormattedMessage id='account.signin.changeEmail' defaultMessage='Cambiar correo' />
              </button>
            </div>
          </div>

          <div className='separator separator-dashed my-6'></div>

          <div className='d-flex flex-wrap align-items-center mb-10'>
            <div id='kt_signin_password' className={' ' + (showPasswordForm && 'd-none')}>
              <div className='fs-6 fw-bolder mb-1'>
                <FormattedMessage id='common.password' defaultMessage='Contraseña' />
              </div>
              <div className='fw-bold text-gray-600'>************</div>
            </div>

            <div
              id='kt_signin_password_edit'
              className={'flex-row-fluid ' + (!showPasswordForm && 'd-none')}
            >
              <form
                onSubmit={formik2.handleSubmit}
                id='kt_signin_change_password'
                className='form'
                noValidate
              >
                <div className='row mb-1'>
                  <div className='col-lg-4'>
                    <div className='fv-row mb-0'>
                      <label htmlFor='currentpassword' className='form-label fs-6 fw-bolder mb-3'>
                        <FormattedMessage
                          id='account.signin.currentPassword'
                          defaultMessage='Contraseña actual'
                        />
                      </label>
                      <input
                        type='password'
                        className='form-control form-control-lg form-control-solid '
                        id='currentpassword'
                        {...formik2.getFieldProps('currentPassword')}
                      />
                      {formik2.touched.currentPassword && formik2.errors.currentPassword && (
                        <div className='fv-plugins-message-container'>
                          <div className='fv-help-block'>{formik2.errors.currentPassword}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='col-lg-4'>
                    <div className='fv-row mb-0'>
                      <label htmlFor='newpassword' className='form-label fs-6 fw-bolder mb-3'>
                        <FormattedMessage
                          id='account.signin.newPassword'
                          defaultMessage='Nueva contraseña'
                        />
                      </label>
                      <input
                        type='password'
                        className='form-control form-control-lg form-control-solid '
                        id='newpassword'
                        {...formik2.getFieldProps('newPassword')}
                      />
                      {formik2.touched.newPassword && formik2.errors.newPassword && (
                        <div className='fv-plugins-message-container'>
                          <div className='fv-help-block'>{formik2.errors.newPassword}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='col-lg-4'>
                    <div className='fv-row mb-0'>
                      <label htmlFor='confirmpassword' className='form-label fs-6 fw-bolder mb-3'>
                        <FormattedMessage
                          id='account.signin.confirmNewPassword'
                          defaultMessage='Confirma la nueva contraseña'
                        />
                      </label>
                      <input
                        type='password'
                        className='form-control form-control-lg form-control-solid '
                        id='confirmpassword'
                        {...formik2.getFieldProps('passwordConfirmation')}
                      />
                      {formik2.touched.passwordConfirmation && formik2.errors.passwordConfirmation && (
                        <div className='fv-plugins-message-container'>
                          <div className='fv-help-block'>{formik2.errors.passwordConfirmation}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className='form-text mb-5'>
                  <FormattedMessage
                    id='account.signin.passwordHint'
                    defaultMessage='La contraseña debe tener al menos 8 caracteres y contener letras, números y símbolos'
                  />
                </div>

                <div className='d-flex'>
                  <button
                    id='kt_password_submit'
                    type='submit'
                    className='btn btn-primary me-2 px-6'
                    disabled={loading2}
                  >
                    {!loading2 && (
                      <FormattedMessage
                        id='account.signin.updatePassword'
                        defaultMessage='Actualizar contraseña'
                      />
                    )}
                    {loading2 && (
                      <span className='indicator-progress' style={{display: 'block'}}>
                        <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />{' '}
                        <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setPasswordForm(false)
                    }}
                    id='kt_password_cancel'
                    type='button'
                    className='btn btn-color-gray-500 btn-active-light-primary px-6'
                  >
                    <FormattedMessage id='common.cancel' defaultMessage='Cancelar' />
                  </button>
                </div>
              </form>
            </div>

            <div
              id='kt_signin_password_button'
              className={'ms-auto ' + (showPasswordForm && 'd-none')}
            >
              <button
                onClick={() => {
                  setPasswordForm(true)
                }}
                className='btn btn-light btn-active-light-primary'
              >
                <FormattedMessage id='account.signin.resetPassword' defaultMessage='Restablecer contraseña' />
              </button>
            </div>
          </div>

          {isPlatform && (
            <div className='notice d-flex bg-light-primary rounded border-primary border border-dashed p-6'>
              <KTIcon iconName='shield-tick' className='fs-2tx text-primary me-4' />
              <div className='d-flex flex-stack flex-grow-1 flex-wrap flex-md-nowrap'>
                <div className='mb-3 mb-md-0 fw-bold'>
                  <h4 className='text-gray-800 fw-bolder'>
                    <FormattedMessage
                      id='account.signin.secureTitle'
                      defaultMessage='Protege tu cuenta'
                    />
                  </h4>
                  <div className='fs-6 text-gray-600 pe-7'>
                    <FormattedMessage
                      id='account.signin.secureBody'
                      defaultMessage='La autenticación en dos pasos añade una capa extra de seguridad a tu cuenta. Para iniciar sesión, además deberás proporcionar un código de 6 dígitos.'
                    />
                  </div>
                </div>
                <a
                  href='#kt_account_two_factor'
                  className='btn btn-primary px-6 align-self-center text-nowrap'
                >
                  <FormattedMessage id='account.signin.enable' defaultMessage='Configurar' />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export {SignInMethod}