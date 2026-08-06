
import {useMemo, useState} from 'react'
import * as Yup from 'yup'
import clsx from 'clsx'
import {Link} from 'react-router-dom'
import {useFormik} from 'formik'
import {FormattedMessage, useIntl, IntlShape} from 'react-intl'
import {getUserByToken, isMfaRequiredError, login} from '../core/_requests'
import {toAbsoluteUrl} from '../../../../_metronic/helpers'
import {useAuth} from '../core/Auth'

const makeLoginSchema = (intl: IntlShape, mfaRequired: boolean) =>
  Yup.object().shape({
    email: Yup.string()
      .email(intl.formatMessage({id: 'auth.validation.emailInvalid', defaultMessage: 'Formato de correo electrónico inválido'}))
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.emailRequired', defaultMessage: 'El correo electrónico es obligatorio'})),
    password: Yup.string()
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.passwordRequired', defaultMessage: 'La contraseña es obligatoria'})),
    // El codigo TOTP solo se valida cuando el backend ya exigio MFA.
    code: mfaRequired
      ? Yup.string()
          .matches(/^\d{6}$/, intl.formatMessage({id: 'auth.mfa.codeInvalid', defaultMessage: 'El código debe tener 6 dígitos'}))
          .required(intl.formatMessage({id: 'auth.mfa.codeRequired', defaultMessage: 'El código de verificación es obligatorio'}))
      : Yup.string(),
  })

const initialValues = {
  email: '',
  password: '',
  code: '',
}

/*
  Formik+YUP+Typescript:
  https://jaredpalmer.com/formik/docs/tutorial#getfieldprops
  https://medium.com/@maurice.de.beijer/yup-validation-and-typescript-and-formik-6c342578a20e
*/

export function Login() {
  const intl = useIntl()
  const [loading, setLoading] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const {saveAuth, setCurrentUser} = useAuth()
  const loginSchema = useMemo(() => makeLoginSchema(intl, mfaRequired), [intl, mfaRequired])

  const formik = useFormik({
    initialValues,
    validationSchema: loginSchema,
    onSubmit: async (values, {setStatus, setSubmitting}) => {
      setLoading(true)
      try {
        const {data: auth} = await login(
          values.email,
          values.password,
          mfaRequired ? values.code : undefined
        )
        saveAuth(auth)
        const {data: user} = await getUserByToken(auth.api_token)
        setCurrentUser(user)
      } catch (error) {
        console.error(error)
        saveAuth(undefined)
        // El backend pide MFA: revela el campo de codigo y deja reintentar con `code`.
        if (isMfaRequiredError(error)) {
          setMfaRequired(true)
          setStatus(
            intl.formatMessage({
              id: 'auth.mfa.required',
              defaultMessage: 'Ingresa el código de verificación de tu app autenticadora',
            })
          )
          setSubmitting(false)
          setLoading(false)
          return
        }
        setStatus(
          intl.formatMessage({
            id: 'auth.login.error',
            defaultMessage: 'Los datos de acceso son incorrectos',
          })
        )
        setSubmitting(false)
        setLoading(false)
      }
    },
  })

  return (
    <form
      className='form w-100'
      onSubmit={formik.handleSubmit}
      noValidate
      id='kt_login_signin_form'
    >
      {/* begin::Heading */}
      <div className='text-center mb-11'>
        <h1 className='text-gray-900 fw-bolder mb-3'>
          <FormattedMessage id='auth.login.title' defaultMessage='Iniciar sesión' />
        </h1>
        <div className='text-gray-500 fw-semibold fs-6'>
          <FormattedMessage id='auth.login.subtitle' defaultMessage='Bienvenido de nuevo' />
        </div>
      </div>
      {/* begin::Heading */}

      {/* begin::Login options */}
      <div className='row g-3 mb-9'>
        {/* begin::Col */}
        <div className='col-md-6'>
          {/* begin::Google link */}
          <a
            href='#'
            className='btn btn-flex btn-outline btn-text-gray-700 btn-active-color-primary bg-state-light flex-center text-nowrap w-100'
          >
            <img
              alt='Logo'
              src={toAbsoluteUrl('media/svg/brand-logos/google-icon.svg')}
              className='h-15px me-3'
            />
            <FormattedMessage id='auth.social.google' defaultMessage='Ingresar con Google' />
          </a>
          {/* end::Google link */}
        </div>
        {/* end::Col */}

        {/* begin::Col */}
        <div className='col-md-6'>
          {/* begin::Google link */}
          <a
            href='#'
            className='btn btn-flex btn-outline btn-text-gray-700 btn-active-color-primary bg-state-light flex-center text-nowrap w-100'
          >
            <img
              alt='Logo'
              src={toAbsoluteUrl('media/svg/brand-logos/apple-black.svg')}
              className='theme-light-show h-15px me-3'
            />
            <img
              alt='Logo'
              src={toAbsoluteUrl('media/svg/brand-logos/apple-black-dark.svg')}
              className='theme-dark-show h-15px me-3'
            />
            <FormattedMessage id='auth.social.apple' defaultMessage='Ingresar con Apple' />
          </a>
          {/* end::Google link */}
        </div>
        {/* end::Col */}
      </div>
      {/* end::Login options */}

      {/* begin::Separator */}
      <div className='separator separator-content my-14'>
        <span className='w-125px text-gray-500 fw-semibold fs-7'>
          <FormattedMessage id='auth.common.orWithEmail' defaultMessage='O con correo electrónico' />
        </span>
      </div>
      {/* end::Separator */}

      {formik.status ? (
        <div className='mb-lg-15 alert alert-danger'>
          <div className='alert-text font-weight-bold'>{formik.status}</div>
        </div>
      ) : null}

      {/* begin::Form group */}
      <div className='fv-row mb-8'>
        <label className='form-label fs-6 fw-bolder text-gray-900'>
          <FormattedMessage id='common.email' defaultMessage='Correo electrónico' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'common.email', defaultMessage: 'Correo electrónico'})}
          {...formik.getFieldProps('email')}
          className={clsx(
            'form-control bg-transparent',
            {'is-invalid': formik.touched.email && formik.errors.email},
            {
              'is-valid': formik.touched.email && !formik.errors.email,
            }
          )}
          type='email'
          name='email'
          autoComplete='off'
        />
        {formik.touched.email && formik.errors.email && (
          <div className='fv-plugins-message-container'>
            <span role='alert'>{formik.errors.email}</span>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::Form group */}
      <div className='fv-row mb-3'>
        <label className='form-label fw-bolder text-gray-900 fs-6 mb-0'>
          <FormattedMessage id='common.password' defaultMessage='Contraseña' />
        </label>
        <input
          type='password'
          autoComplete='off'
          {...formik.getFieldProps('password')}
          className={clsx(
            'form-control bg-transparent',
            {
              'is-invalid': formik.touched.password && formik.errors.password,
            },
            {
              'is-valid': formik.touched.password && !formik.errors.password,
            }
          )}
        />
        {formik.touched.password && formik.errors.password && (
          <div className='fv-plugins-message-container'>
            <div className='fv-help-block'>
              <span role='alert'>{formik.errors.password}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::MFA code (solo si el backend lo exige) */}
      {mfaRequired && (
        <div className='fv-row mb-8'>
          <label className='form-label fw-bolder text-gray-900 fs-6'>
            <FormattedMessage id='auth.mfa.code' defaultMessage='Código de verificación' />
          </label>
          <input
            type='text'
            inputMode='numeric'
            autoComplete='one-time-code'
            maxLength={6}
            placeholder='000000'
            name='code'
            value={formik.values.code}
            onChange={(e) =>
              formik.setFieldValue('code', e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            onBlur={formik.handleBlur}
            className={clsx(
              'form-control bg-transparent',
              {'is-invalid': formik.touched.code && formik.errors.code},
              {'is-valid': formik.touched.code && !formik.errors.code}
            )}
          />
          <div className='form-text'>
            <FormattedMessage
              id='auth.mfa.codeHint'
              defaultMessage='Introduce el código de 6 dígitos de tu app autenticadora.'
            />
          </div>
          {formik.touched.code && formik.errors.code && (
            <div className='fv-plugins-message-container'>
              <div className='fv-help-block'>
                <span role='alert'>{formik.errors.code}</span>
              </div>
            </div>
          )}
        </div>
      )}
      {/* end::MFA code */}

      {/* begin::Wrapper */}
      <div className='d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold mb-8'>
        <div />

        {/* begin::Link */}
        <Link to='/auth/forgot-password' className='link-primary'>
          <FormattedMessage id='auth.login.forgotPassword' defaultMessage='¿Olvidaste tu contraseña?' />
        </Link>
        {/* end::Link */}
      </div>
      {/* end::Wrapper */}

      {/* begin::Action */}
      <div className='d-grid mb-10'>
        <button
          type='submit'
          id='kt_sign_in_submit'
          className='btn btn-primary'
          disabled={formik.isSubmitting || !formik.isValid}
        >
          {!loading && (
            <span className='indicator-label'>
              <FormattedMessage id='auth.login.submit' defaultMessage='Continuar' />
            </span>
          )}
          {loading && (
            <span className='indicator-progress' style={{display: 'block'}}>
              <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          )}
        </button>
      </div>
      {/* end::Action */}

      <div className='text-gray-500 text-center fw-semibold fs-6'>
        <FormattedMessage id='auth.login.noAccount' defaultMessage='¿Aún no tienes una cuenta?' />{' '}
        <Link to='/auth/registration' className='link-primary'>
          <FormattedMessage id='auth.login.signUp' defaultMessage='Regístrate' />
        </Link>
      </div>
    </form>
  )
}
