import {useMemo, useState} from 'react'
import * as Yup from 'yup'
import clsx from 'clsx'
import {Link} from 'react-router-dom'
import {useFormik} from 'formik'
import {FormattedMessage, useIntl, IntlShape} from 'react-intl'
import {requestPassword} from '../core/_requests'

const initialValues = {
  email: 'admin@demo.com',
}

const makeForgotPasswordSchema = (intl: IntlShape) =>
  Yup.object().shape({
    email: Yup.string()
      .email(intl.formatMessage({id: 'auth.validation.emailInvalid', defaultMessage: 'Formato de correo electrónico inválido'}))
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.emailRequired', defaultMessage: 'El correo electrónico es obligatorio'})),
  })

export function ForgotPassword() {
  const intl = useIntl()
  const [loading, setLoading] = useState(false)
  const [hasErrors, setHasErrors] = useState<boolean | undefined>(undefined)
  const forgotPasswordSchema = useMemo(() => makeForgotPasswordSchema(intl), [intl])
  const formik = useFormik({
    initialValues,
    validationSchema: forgotPasswordSchema,
    onSubmit: (values, {setStatus, setSubmitting}) => {
      setLoading(true)
      setHasErrors(undefined)
      setTimeout(() => {
        requestPassword(values.email)
          .then(() => {
            setHasErrors(false)
            setLoading(false)
          })
          .catch(() => {
            setHasErrors(true)
            setLoading(false)
            setSubmitting(false)
            setStatus(
              intl.formatMessage({
                id: 'auth.login.error',
                defaultMessage: 'Los datos de acceso son incorrectos',
              })
            )
          })
      }, 1000)
    },
  })

  return (
    <form
      className='form w-100 fv-plugins-bootstrap5 fv-plugins-framework'
      noValidate
      id='kt_login_password_reset_form'
      onSubmit={formik.handleSubmit}
    >
      <div className='text-center mb-10'>
        {/* begin::Title */}
        <h1 className='text-gray-900 fw-bolder mb-3'>
          <FormattedMessage id='auth.forgotPassword.title' defaultMessage='¿Olvidaste tu contraseña?' />
        </h1>
        {/* end::Title */}

        {/* begin::Link */}
        <div className='text-gray-500 fw-semibold fs-6'>
          <FormattedMessage
            id='auth.forgotPassword.subtitle'
            defaultMessage='Ingresa tu correo electrónico para restablecer tu contraseña.'
          />
        </div>
        {/* end::Link */}
      </div>

      {/* begin::Title */}
      {hasErrors === true && (
        <div className='mb-lg-15 alert alert-danger'>
          <div className='alert-text font-weight-bold'>
            <FormattedMessage
              id='auth.forgotPassword.error'
              defaultMessage='Lo sentimos, se detectaron algunos errores. Por favor, inténtalo de nuevo.'
            />
          </div>
        </div>
      )}

      {hasErrors === false && (
        <div className='mb-10 bg-light-info p-8 rounded'>
          <div className='text-info'>
            <FormattedMessage
              id='auth.forgotPassword.success'
              defaultMessage='Hemos enviado el restablecimiento de contraseña. Por favor, revisa tu correo electrónico.'
            />
          </div>
        </div>
      )}
      {/* end::Title */}

      {/* begin::Form group */}
      <div className='fv-row mb-8'>
        <label className='form-label fw-bolder text-gray-900 fs-6'>
          <FormattedMessage id='auth.field.email' defaultMessage='Correo electrónico' />
        </label>
        <input
          type='email'
          placeholder=''
          autoComplete='off'
          {...formik.getFieldProps('email')}
          className={clsx(
            'form-control bg-transparent',
            {'is-invalid': formik.touched.email && formik.errors.email},
            {
              'is-valid': formik.touched.email && !formik.errors.email,
            }
          )}
        />
        {formik.touched.email && formik.errors.email && (
          <div className='fv-plugins-message-container'>
            <div className='fv-help-block'>
              <span role='alert'>{formik.errors.email}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::Form group */}
      <div className='d-flex flex-wrap justify-content-center pb-lg-0'>
        <button type='submit' id='kt_password_reset_submit' className='btn btn-primary me-4'>
          <span className='indicator-label'>
            <FormattedMessage id='auth.common.submit' defaultMessage='Enviar' />
          </span>
          {loading && (
            <span className='indicator-progress'>
              <FormattedMessage id='auth.common.pleaseWait' defaultMessage='Por favor espera...' />
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          )}
        </button>
        <Link to='/auth/login'>
          <button
            type='button'
            id='kt_login_password_reset_form_cancel_button'
            className='btn btn-light'
            disabled={formik.isSubmitting || !formik.isValid}
          >
            <FormattedMessage id='auth.common.cancel' defaultMessage='Cancelar' />
          </button>
        </Link>{' '}
      </div>
      {/* end::Form group */}
    </form>
  )
}
