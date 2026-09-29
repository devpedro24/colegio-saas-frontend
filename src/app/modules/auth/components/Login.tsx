
import {useMemo, useState} from 'react'
import * as Yup from 'yup'
import clsx from 'clsx'
import {Link} from 'react-router-dom'
import {useFormik} from 'formik'
import {FormattedMessage, useIntl, IntlShape} from 'react-intl'
import {getUserByToken, isMfaRequiredError, login} from '../core/_requests'
import {toAbsoluteUrl} from '../../../../_metronic/helpers'
import {useAuth} from '../core/Auth'
import {PasswordField} from '@/app/shared/components/PasswordField'

const makeLoginSchema = (intl: IntlShape, mfaRequired: boolean) =>
  Yup.object().shape({
    email: Yup.string()
      .email(intl.formatMessage({id: 'auth.validation.emailInvalid'}))
      .min(3, intl.formatMessage({id: 'auth.validation.min'}, {min: 3}))
      .max(50, intl.formatMessage({id: 'auth.validation.max'}, {max: 50}))
      .required(intl.formatMessage({id: 'auth.validation.emailRequired'})),
    password: Yup.string().required(intl.formatMessage({id: 'auth.validation.passwordRequired'})),
    // El codigo TOTP solo se valida cuando el backend ya exigio MFA.
    code: mfaRequired
      ? Yup.string()
          .matches(/^\d{6}$/, intl.formatMessage({id: 'auth.mfa.codeInvalid'}))
          .required(intl.formatMessage({id: 'auth.mfa.codeRequired'}))
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
            })
          )
          setSubmitting(false)
          setLoading(false)
          return
        }
        setStatus(
          intl.formatMessage({
            id: 'auth.login.error',
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
          <FormattedMessage id='auth.login.title' />
        </h1>
        <div className='text-gray-500 fw-semibold fs-6'>
          <FormattedMessage id='auth.login.subtitle' />
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

      {/* begin::Separator */}
      <div className='separator separator-content my-14'>
        <span className='w-125px text-gray-500 fw-semibold fs-7'>
          <FormattedMessage id='auth.common.orWithEmail' />
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
          <FormattedMessage id='common.email' />
        </label>
        <input
          placeholder={intl.formatMessage({id: 'common.email'})}
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
          <FormattedMessage id='common.password' />
        </label>
        <PasswordField
          autoComplete='current-password'
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
            <FormattedMessage id='auth.mfa.code' />
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
          <FormattedMessage id='auth.login.forgotPassword' />
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
              <FormattedMessage id='auth.login.submit' />
            </span>
          )}
          {loading && (
            <span className='indicator-progress' style={{display: 'block'}}>
              <FormattedMessage id='common.pleaseWait' />
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          )}
        </button>
      </div>
      {/* end::Action */}

      <div className='text-gray-500 text-center fw-semibold fs-6'>
        <FormattedMessage id='auth.login.noAccount' />{' '}
        <Link to='/auth/registration' className='link-primary'>
          <FormattedMessage id='auth.login.signUp' />
        </Link>
      </div>
    </form>
  )
}
