

import {useMemo, useState, useEffect} from 'react'
import {useFormik} from 'formik'
import * as Yup from 'yup'
import {PasswordField} from '@/app/shared/components/PasswordField'
import {PasswordRequirements} from '@/app/shared/components/PasswordRequirements'
import {passwordMeetsPolicy} from '@/app/shared/passwordPolicy'
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
      .min(3, intl.formatMessage({id: 'auth.validation.min'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.firstnameRequired'})),
    email: Yup.string()
      .email(intl.formatMessage({id: 'auth.validation.emailInvalid'}))
      .min(3, intl.formatMessage({id: 'auth.validation.min'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.emailRequired'})),
    lastname: Yup.string()
      .min(3, intl.formatMessage({id: 'auth.validation.min'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.lastnameRequired'})),
    password: Yup.string()
      .test('policy', intl.formatMessage({id: 'password.invalid'}), value => passwordMeetsPolicy(value ?? ''))
      .required(intl.formatMessage({id: 'auth.validation.passwordRequired'})),
    changepassword: Yup.string()
      .required(intl.formatMessage({id: 'auth.validation.confirmPasswordRequired'}))
      .oneOf(
        [Yup.ref('password')],
        intl.formatMessage({id: 'auth.validation.passwordMismatch'})
      ),
    acceptTerms: Yup.bool().required(
      intl.formatMessage({id: 'auth.validation.acceptTermsRequired'})
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
          <FormattedMessage id='auth.registration.title' />
        </h1>
        {/* end::Title */}

        <div className='text-gray-500 fw-semibold fs-6'>
          <FormattedMessage id='auth.registration.subtitle' />
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
            <FormattedMessage id='auth.social.google' />
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
            <FormattedMessage id='auth.social.apple' />
          </a>
          {/* end::Google link */}
        </div>
        {/* end::Col */}
      </div>
      {/* end::Login options */}

      <div className='separator separator-content my-14'>
        <span className='w-125px text-gray-500 fw-semibold fs-7'>
          <FormattedMessage id='auth.common.orWithEmail' />
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
          <FormattedMessage id='auth.field.firstname' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'auth.field.firstname'})}
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
          <FormattedMessage id='auth.field.lastname' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'auth.field.lastname'})}
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
          <FormattedMessage id='common.email' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'common.email'})}
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
            <FormattedMessage id='common.password' />
          </label>
          <div className='position-relative mb-3'>
            <PasswordField
              placeholder={intl.formatMessage({id: 'common.password'})}
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
          <PasswordRequirements password={formik.values.password} />
      </div>
      {/* end::Form group */}

      {/* begin::Form group Confirm password */}
      <div className='fv-row mb-5'>
        <label className='form-label fw-bolder text-gray-900 fs-6'>
          <FormattedMessage id='auth.field.confirmPassword' />
        </label>
        <PasswordField
          placeholder={intl.formatMessage({id: 'auth.field.confirmPassword'})}
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
              <FormattedMessage id='auth.common.submit' />
            </span>
          )}
          {loading && (
            <span className='indicator-progress' style={{display: 'block'}}>
              <FormattedMessage id='common.pleaseWait' />{' '}
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
            <FormattedMessage id='common.cancel' />
          </button>
        </Link>
      </div>
      {/* end::Form group */}
    </form>
  )
}
