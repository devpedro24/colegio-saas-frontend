import {FC, useState} from 'react'
import {useIntl} from 'react-intl'
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

// Formulario interno: se remonta (via key) cuando llegan los datos del backend.
const DatosForm: FC<{datos: DatosInstitucionales | undefined}> = ({datos}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const update = useUpdateDatosInstitucionales()

  const [form, setForm] = useState<FormState>(fromDatos(datos))
  const [error, setError] = useState<ApiError | null>(null)

  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<FormState>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: React.FormEvent) => {
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
        onSuccess: () => toast.success(t('academico.config.datos.toast.saved')),
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(err)
            if (!err.errors) toast.error(err.message)
          } else {
            toast.error(t('academico.config.datos.toast.saveError'))
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
            onChange={(e) => set({nombre: e.target.value})}
          />
          {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>{t('academico.config.datos.field.nit')}</label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('nit') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.nitPh')}
            value={form.nit}
            onChange={(e) => set({nit: e.target.value})}
          />
          {fe('nit') && <div className='invalid-feedback'>{fe('nit')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>
            {t('academico.config.datos.field.resolucion')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('resolucion_men') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.resolucionPh')}
            value={form.resolucion_men}
            onChange={(e) => set({resolucion_men: e.target.value})}
          />
          {fe('resolucion_men') && <div className='invalid-feedback'>{fe('resolucion_men')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>
            {t('academico.config.datos.field.telefono')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('telefono') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.telefonoPh')}
            value={form.telefono}
            onChange={(e) => set({telefono: e.target.value})}
          />
          {fe('telefono') && <div className='invalid-feedback'>{fe('telefono')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>
            {t('academico.config.datos.field.direccion')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('direccion') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.direccionPh')}
            value={form.direccion}
            onChange={(e) => set({direccion: e.target.value})}
          />
          {fe('direccion') && <div className='invalid-feedback'>{fe('direccion')}</div>}
        </div>
        <div className='col-md-6 fv-row mb-7'>
          <label className='fs-6 fw-semibold mb-2'>
            {t('academico.config.datos.field.correo')}
          </label>
          <input
            type='email'
            className={`form-control form-control-solid ${fe('correo') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.datos.field.correoPh')}
            value={form.correo}
            onChange={(e) => set({correo: e.target.value})}
          />
          {fe('correo') && <div className='invalid-feedback'>{fe('correo')}</div>}
        </div>
      </div>

      <div className='d-flex justify-content-end'>
        <button type='submit' className='btn btn-primary' disabled={update.isPending}>
          {update.isPending ? (
            <span className='indicator-progress d-block'>
              {t('common.saving')}
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
            <span className='text-muted fs-6'>{t('academico.config.datos.loading')}</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center my-3'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{t('academico.config.datos.loadError')}</span>
          </div>
        )}

        {!isLoading && !isError && <DatosForm key={data?.nombre ?? 'empty'} datos={data} />}
      </div>
    </div>
  )
}

export {DatosInstitucionalesCard}
