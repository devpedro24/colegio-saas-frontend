import {FC, useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import * as Yup from 'yup'
import {useFormik} from 'formik'
import {useAuth} from '../../../../auth'
import {useToast} from '@/lib/ui/toast'
import {ApiError} from '@/lib/api/client'
import {useUpdateProfile} from '@/app/pages/account/account.api'

interface IProfileFields {
  name: string
  phone: string
}

// Card de "Detalles del perfil": edición REAL de nombre completo y teléfono.
// Los datos vienen del usuario autenticado (contexto) y se persisten en el
// backend (PUT /account/profile); la UI se refresca con la respuesta.
const ProfileDetails: FC = () => {
  const intl = useIntl()
  const toast = useToast()
  const {currentUser, setCurrentUser} = useAuth()

  const [loading, setLoading] = useState(false)

  const profileMutation = useUpdateProfile()

  const profileSchema = Yup.object().shape({
    name: Yup.string()
      .required(
        intl.formatMessage({
          id: 'account.profile.nameRequired',
          defaultMessage: 'El nombre es obligatorio',
        }),
      )
      .max(160, intl.formatMessage({id: 'account.profile.nameMax', defaultMessage: 'Máximo 160 caracteres'})),
    phone: Yup.string().max(
      32,
      intl.formatMessage({id: 'account.profile.phoneMax', defaultMessage: 'Máximo 32 caracteres'}),
    ),
  })

  const formik = useFormik<IProfileFields>({
    initialValues: {
      name: currentUser?.name ?? '',
      phone: currentUser?.phone ?? '',
    },
    validationSchema: profileSchema,
    onSubmit: (values) => {
      setLoading(true)
      profileMutation.mutate(
        {
          name: values.name.trim(),
          phone: values.phone.trim(),
        },
        {
          onSuccess: (data) => {
            const user = data.user
            if (user) {
              setCurrentUser((prev) =>
                prev
                  ? {
                      ...prev,
                      name: user.name,
                      phone: user.phone ?? null,
                    }
                  : prev,
              )
            }
            toast.success(data.message ?? 'Perfil actualizado.')
            setLoading(false)
          },
          onError: (err) => {
            toast.error(err instanceof ApiError ? err.message : 'No se pudo actualizar el perfil.')
            setLoading(false)
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
        data-bs-target='#kt_account_profile_details'
        aria-expanded='true'
        aria-controls='kt_account_profile_details'
      >
        <div className='card-title m-0'>
          <h3 className='fw-bold m-0'>
            <FormattedMessage id='account.profileDetails' defaultMessage='Detalles del perfil' />
          </h3>
        </div>
      </div>

      <div id='kt_account_profile_details' className='collapse show'>
        <form onSubmit={formik.handleSubmit} noValidate className='form'>
          <div className='card-body border-top p-9'>
            <div className='row mb-6'>
              <label className='col-lg-4 col-form-label required fw-bold fs-6'>
                <FormattedMessage id='common.name' defaultMessage='Nombre completo' />
              </label>

              <div className='col-lg-8 fv-row'>
                <input
                  type='text'
                  className='form-control form-control-lg form-control-solid'
                  placeholder={intl.formatMessage({
                    id: 'account.profile.namePh',
                    defaultMessage: 'Tu nombre completo',
                  })}
                  {...formik.getFieldProps('name')}
                />
                {formik.touched.name && formik.errors.name && (
                  <div className='fv-plugins-message-container'>
                    <div className='fv-help-block'>{formik.errors.name}</div>
                  </div>
                )}
              </div>
            </div>

            <div className='row mb-0'>
              <label className='col-lg-4 col-form-label fw-bold fs-6'>
                <FormattedMessage id='account.field.contactPhone' defaultMessage='Teléfono de contacto' />
              </label>

              <div className='col-lg-8 fv-row'>
                <input
                  type='tel'
                  className='form-control form-control-lg form-control-solid'
                  placeholder={intl.formatMessage({
                    id: 'account.profile.contactPhonePh',
                    defaultMessage: 'Número de teléfono',
                  })}
                  {...formik.getFieldProps('phone')}
                />
                {formik.touched.phone && formik.errors.phone && (
                  <div className='fv-plugins-message-container'>
                    <div className='fv-help-block'>{formik.errors.phone}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className='card-footer d-flex justify-content-end py-6 px-9'>
            <button type='submit' className='btn btn-primary' disabled={loading}>
              {!loading && <FormattedMessage id='common.save' defaultMessage='Guardar cambios' />}
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

export {ProfileDetails}