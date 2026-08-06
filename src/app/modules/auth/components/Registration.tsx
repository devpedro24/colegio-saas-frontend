

import {useMemo, useState, useEffect} from 'react'
import {useFormik} from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import {FormattedMessage, useIntl, IntlShape} from 'react-intl'
import {getUserByToken, register} from '../core/_requests'
import {Link} from 'react-router-dom'
import {toAbsoluteUrl} from '../../../../_metronic/helpers'
import {PasswordMeterComponent} from '../../../../_metronic/assets/ts/components'
import {useAuth} from '../core/Auth'

const initialValues = {
  firstname: '',
  lastname: '',
  email: '',
  password: '',
  changepassword: '',
  acceptTerms: false,
}

const makeRegistrationSchema = (intl: IntlShape) =>
  Yup.object().shape({
    firstname: Yup.string()
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.firstnameRequired', defaultMessage: 'El nombre es obligatorio'})),
    email: Yup.string()
      .email(intl.formatMessage({id: 'auth.validation.emailInvalid', defaultMessage: 'Formato de correo electrónico inválido'}))
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.emailRequired', defaultMessage: 'El correo electrónico es obligatorio'})),
    lastname: Yup.string()
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.lastnameRequired', defaultMessage: 'El apellido es obligatorio'})),
    password: Yup.string()
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.passwordRequired', defaultMessage: 'La contraseña es obligatoria'})),
    changepassword: Yup.string()
      .min(3, intl.formatMessage({id: 'auth.validation.min', defaultMessage: 'Mínimo {min} caracteres'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max', defaultMessage: 'Máximo {max} caracteres'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.confirmPasswordRequired', defaultMessage: 'La confirmación de contraseña es obligatoria'}))
      .oneOf(
        [Yup.ref('password')],
        intl.formatMessage({id: 'auth.validation.passwordMismatch', defaultMessage: 'Las contraseñas no coinciden'})
      ),
    acceptTerms: Yup.bool().required(
      intl.formatMessage({id: 'auth.validation.acceptTermsRequired', defaultMessage: 'Debes aceptar los términos y condiciones'})
    ),
  })

export function Registration() {
  const intl = useIntl()
  const [loading, setLoading] = useState(false)
  const {saveAuth, setCurrentUser} = useAuth()
  const registrationSchema = useMemo(() => makeRegistrationSchema(intl), [intl])

  const formik = useFormik({
    initialValues,
    validationSchema: registrationSchema,
    onSubmit: async (values, {setStatus, setSubmitting}) => {
      setLoading(true)
      try {
        const {data: auth} = await register(
          values.email,
          values.firstname,
          values.lastname,
          values.password,
          values.changepassword
        )
        saveAuth(auth)
        const {data: user} = await getUserByToken(auth.api_token)
        setCurrentUser(user)
      } catch (error) {
        console.error(error)
        saveAuth(undefined)
        setStatus(
          intl.formatMessage({
            id: 'auth.registration.error',
            defaultMessage: 'Los datos de registro son incorrectos',
          })
        )
        setSubmitting(false)
        setLoading(false)
      }
    },
  })

  useEffect(() => {
    PasswordMeterComponent.bootstrap()
  }, [])

  return (
    <form
      className='form w-100 fv-plugins-bootstrap5 fv-plugins-framework'
      noValidate
      id='kt_login_signup_form'
      onSubmit={formik.handleSubmit}
    >
      {/* begin::Heading */}
      <div className='text-center mb-11'>
        {/* begin::Title */}
        <h1 className='text-gray-900 fw-bolder mb-3'>
          <FormattedMessage id='auth.registration.title' defaultMessage='Crear cuenta' />
        </h1>
        {/* end::Title */}

        <div className='text-gray-500 fw-semibold fs-6'>
          <FormattedMessage id='auth.registration.subtitle' defaultMessage='Crea tu cuenta para comenzar' />
        </div>
      </div>
      {/* end::Heading */}

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

      <div className='separator separator-content my-14'>
        <span className='w-125px text-gray-500 fw-semibold fs-7'>
          <FormattedMessage id='auth.common.orWithEmail' defaultMessage='O con correo electrónico' />
        </span>
      </div>

      {formik.status && (
        <div className='mb-lg-15 alert alert-danger'>
          <div className='alert-text font-weight-bold'>{formik.status}</div>
        </div>
      )}

      {/* begin::Form group Firstname */}
      <div className='fv-row mb-8'>
        <label className='form-label fw-bolder text-gray-900 fs-6'>
          <FormattedMessage id='auth.field.firstname' defaultMessage='Nombres' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'auth.field.firstname', defaultMessage: 'Nombres'})}
          type='text'
          autoComplete='off'
          {...formik.getFieldProps('firstname')}
          className={clsx(
            'form-control bg-transparent',
            {
              'is-invalid': formik.touched.firstname && formik.errors.firstname,
            },
            {
              'is-valid': formik.touched.firstname && !formik.errors.firstname,
            }
          )}
        />
        {formik.touched.firstname && formik.errors.firstname && (
          <div className='fv-plugins-message-container'>
            <div className='fv-help-block'>
              <span role='alert'>{formik.errors.firstname}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}
      <div className='fv-row mb-8'>
        {/* begin::Form group Lastname */}
        <label className='form-label fw-bolder text-gray-900 fs-6'>
          <FormattedMessage id='auth.field.lastname' defaultMessage='Apellidos' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'auth.field.lastname', defaultMessage: 'Apellidos'})}
          type='text'
          autoComplete='off'
          {...formik.getFieldProps('lastname')}
          className={clsx(
            'form-control bg-transparent',
            {
              'is-invalid': formik.touched.lastname && formik.errors.lastname,
            },
            {
              'is-valid': formik.touched.lastname && !formik.errors.lastname,
            }
          )}
        />
        {formik.touched.lastname && formik.errors.lastname && (
          <div className='fv-plugins-message-container'>
            <div className='fv-help-block'>
              <span role='alert'>{formik.errors.lastname}</span>
            </div>
          </div>
        )}
        {/* end::Form group */}
      </div>

      {/* begin::Form group Email */}
      <div className='fv-row mb-8'>
        <label className='form-label fw-bolder text-gray-900 fs-6'>
          <FormattedMessage id='common.email' defaultMessage='Correo electrónico' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'common.email', defaultMessage: 'Correo electrónico'})}
          type='email'
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

      {/* begin::Form group Password */}
      <div className='fv-row mb-8' data-kt-password-meter='true'>
        <div className='mb-1'>
          <label className='form-label fw-bolder text-gray-900 fs-6'>
            <FormattedMessage id='common.password' defaultMessage='Contraseña' />
          </label>
          <div className='position-relative mb-3'>
            <input
              type='password'
              placeholder={intl.formatMessage({id: 'common.password', defaultMessage: 'Contraseña'})}
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
          {/* begin::Meter */}
          <div
            className='d-flex align-items-center mb-3'
            data-kt-password-meter-control='highlight'
          >
            <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2'></div>
            <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2'></div>
            <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2'></div>
            <div className='flex-grow-1 bg-secondary bg-active-success rounded h-5px'></div>
          </div>
          {/* end::Meter */}
        </div>
        <div className='text-muted'>
          <FormattedMessage
            id='auth.registration.passwordHint'
            defaultMessage='Usa 8 o más caracteres con una combinación de letras, números y símbolos.'
          />
        </div>
      </div>
      {/* end::Form group */}

      {/* begin::Form group Confirm password */}
      <div className='fv-row mb-5'>
        <label className='form-label fw-bolder text-gray-900 fs-6'>
          <FormattedMessage id='auth.field.confirmPassword' defaultMessage='Confirmar contraseña' />
        </label>
        <input
          type='password'
          placeholder={intl.formatMessage({id: 'auth.field.confirmPassword', defaultMessage: 'Confirmar contraseña'})}
          autoComplete='off'
          {...formik.getFieldProps('changepassword')}
          className={clsx(
            'form-control bg-transparent',
            {
              'is-invalid': formik.touched.changepassword && formik.errors.changepassword,
            },
            {
              'is-valid': formik.touched.changepassword && !formik.errors.changepassword,
            }
          )}
        />
        {formik.touched.changepassword && formik.errors.changepassword && (
          <div className='fv-plugins-message-container'>
            <div className='fv-help-block'>
              <span role='alert'>{formik.errors.changepassword}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::Form group */}
      <div className='fv-row mb-8'>
        <label className='form-check form-check-inline' htmlFor='kt_login_toc_agree'>
          <input
            className='form-check-input'
            type='checkbox'
            id='kt_login_toc_agree'
            {...formik.getFieldProps('acceptTerms')}
          />
          <span>
            <FormattedMessage
              id='auth.registration.acceptTerms'
              defaultMessage='Acepto los <a>términos y condiciones</a>.'
              values={{
                a: (chunks) => (
                  <a href='#' target='_blank' className='ms-1 link-primary'>
                    {chunks}
                  </a>
                ),
              }}
            />
          </span>
        </label>
        {formik.touched.acceptTerms && formik.errors.acceptTerms && (
          <div className='fv-plugins-message-container'>
            <div className='fv-help-block'>
              <span role='alert'>{formik.errors.acceptTerms}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::Form group */}
      <div className='text-center'>
        <button
          type='submit'
          id='kt_sign_up_submit'
          className='btn btn-lg btn-primary w-100 mb-5'
          disabled={formik.isSubmitting || !formik.isValid || !formik.values.acceptTerms}
        >
          {!loading && (
            <span className='indicator-label'>
              <FormattedMessage id='auth.common.submit' defaultMessage='Crear cuenta' />
            </span>
          )}
          {loading && (
            <span className='indicator-progress' style={{display: 'block'}}>
              <FormattedMessage id='common.pleaseWait' defaultMessage='Por favor espera...' />{' '}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          )}
        </button>
        <Link to='/auth/login'>
          <button
            type='button'
            id='kt_login_signup_form_cancel_button'
            className='btn btn-lg btn-light-primary w-100 mb-5'
          >
            <FormattedMessage id='common.cancel' defaultMessage='Cancelar' />
          </button>
        </Link>
      </div>
      {/* end::Form group */}
    </form>
  )
}
