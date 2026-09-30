import {FC, useState, useEffect, useRef} from 'react'
import type {FormEvent} from 'react'
import {useIntl} from 'react-intl'
import {useQueryClient} from '@tanstack/react-query'
import {useAuth} from '@/app/modules/auth'
import {onboardingKey, useOnboarding} from '@/app/modules/onboarding/onboarding.api'
import {LogoUploader} from '@/app/modules/onboarding/LogoUploader'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useDatosInstitucionales, useUpdateDatosInstitucionales} from '../configuracion.api'
import type {DatosInstitucionales} from '../configuracion.types'

interface FormState {
  nombre: string
  nit: string
  resolucion_men: string
  direccion: string
  telefono: string
  correo: string
}

const fromDatos = (d: DatosInstitucionales | undefined): FormState => ({
  nombre: d?.nombre ?? '',
  nit: d?.nit ?? '',
  resolucion_men: d?.resolucion_men ?? '',
  direccion: d?.direccion ?? '',
  telefono: d?.telefono ?? '',
  correo: d?.correo ?? '',
})

// Actualiza datos remotos solo mientras el usuario no tenga cambios pendientes.
const DatosForm: FC<{datos: DatosInstitucionales | undefined}> = ({datos}) => {
  const intl = useIntl()

  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const update = useUpdateDatosInstitucionales()

  const [form, setForm] = useState<FormState>(fromDatos(datos))
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setForm(fromDatos(datos))
  }, [datos])
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<FormState>) => { editing.current = true; setForm((prev) => ({...prev, ...patch})) }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    update.mutate(
      {
        nombre: form.nombre.trim(),
        nit: form.nit.trim() || null,
        resolucion_men: form.resolucion_men.trim() || null,
        direccion: form.direccion.trim() || null,
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
      },
      {
        onSuccess: () => { editing.current = false; toast.success(t('academico.config.datos.toast.saved')) },
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(err)
            if (!err.errors) toast.error(err.message)
          } else {
            toast.error(t('common.toast.saveError'))
          }
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='row'>
        <div className='col-md-6 fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('academico.config.datos.field.nombre')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.nombrePh')}
            value={form.nombre}
            required
            onChange={(e) => set({nombre: e.target.value})}
          />
          {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>{t('common.field.nit')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('nit') ? 'is-invalid' : ''}`}
            placeholder={t('common.ph.nit')}
            value={form.nit}
            required
            onChange={(e) => set({nit: e.target.value})}
          />
          {fe('nit') && <div className='invalid-feedback'>{fe('nit')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('academico.config.datos.field.resolucion')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('resolucion_men') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.resolucionPh')}
            value={form.resolucion_men}
            required
            onChange={(e) => set({resolucion_men: e.target.value})}
          />
          {fe('resolucion_men') && <div className='invalid-feedback'>{fe('resolucion_men')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('common.phone')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('telefono') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.telefonoPh')}
            value={form.telefono}
            required
            onChange={(e) => set({telefono: e.target.value})}
          />
          {fe('telefono') && <div className='invalid-feedback'>{fe('telefono')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('common.address')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('direccion') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.direccionPh')}
            value={form.direccion}
            required
            onChange={(e) => set({direccion: e.target.value})}
          />
          {fe('direccion') && <div className='invalid-feedback'>{fe('direccion')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('academico.config.datos.field.correo')}
          </label>
          <input
            type='email'
            className={`form-control form-control-solid ${fe('correo') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.correoPh')}
            value={form.correo}
            required
            onChange={(e) => set({correo: e.target.value})}
          />
          {fe('correo') && <div className='invalid-feedback'>{fe('correo')}</div>}
        </div>
      </div>

      <div className='d-flex justify-content-end'>
        <button type='submit' className='btn btn-primary' disabled={update.isPending}>
          {update.isPending ? (
            <span className='indicator-progress d-block'>
              {t('common.pleaseWait')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('academico.config.datos.save')
          )}
        </button>
      </div>
    </form>
  )
}

// Bloque 1: datos institucionales. GET/PUT /config/datos-institucionales (sin filtro de ano).
const DatosInstitucionalesCard: FC = () => {
  const intl = useIntl()

  const t = (id: string) => intl.formatMessage({id})
  const {data, isLoading, isError} = useDatosInstitucionales()

  return (
    <div className='card'>
      <div className='card-header border-0 pt-6'>
        <div className='card-title flex-column align-items-start'>
          <h3 className='fw-bold mb-1'>{t('academico.config.datos.title')}</h3>
          <span className='text-muted fs-7'>{t('academico.config.datos.subtitle')}</span>
        </div>
      </div>
      <div className='card-body py-4'>
        {isLoading && (
          <div className='d-flex justify-content-center align-items-center py-10'>
            <span className='spinner-border text-primary me-3' role='status'></span>
            <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'config.breadcrumb'})})}</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center my-3'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'config.breadcrumb'})})}</span>
          </div>
        )}

        {!isLoading && !isError && <DatosForm datos={data?.data} />}
        {!isLoading && !isError && <LogoEditor />}
      </div>
    </div>
  )
}

const LogoEditor: FC = () => {
  const {currentUser} = useAuth()
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const queryClient = useQueryClient()
  const branding = useOnboarding(currentUser?.tenant_id, !!currentUser?.roles?.includes('rector'))
  const toast = useToast()
  if (!currentUser?.roles?.includes('rector') || currentUser.is_platform) return null

  return <div className='border-top pt-7 mt-7'>
    <h4 className='fw-bold'>{t('onboarding.logo')}</h4>
    <p className='text-muted fs-6 lh-lg'>{t('onboarding.logoHelp')}</p>
    <LogoUploader
      existingUrl={branding.data?.logo_url}
      saveLabel={t('academico.config.datos.saveLogo')}
      onSaved={async () => {
        await queryClient.invalidateQueries({queryKey: onboardingKey(currentUser.tenant_id)})
        toast.success(t('academico.config.datos.toast.logoSaved'))
      }}
    />
  </div>
}

export {DatosInstitucionalesCard}
