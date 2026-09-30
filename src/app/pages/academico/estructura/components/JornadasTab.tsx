import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {useEffect, type FormEvent} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {formatSchoolTime} from '@/lib/format/schoolTime'
import {AcademicYearCell} from '../../academic-year-context'
import {
  useCreateJornada,
  useDeleteJornada,
  useSedes,
  useUpdateJornada,
} from '../estructura.api'
import type {CreateJornadaInput, Jornada} from '../estructura.types'
import {useEstructuraList} from '../useAcademicPagedList'
import {AcademicListFilters} from './AcademicListFilters'
import {DeleteConfirmDialog} from './DeleteConfirmDialog'

const modalsRoot = document.getElementById('root-modals') || document.body

const emptyForm = (): CreateJornadaInput => ({
  sede_id: '',
  nombre: '',
  hora_inicio: '',
  hora_fin: '',
  estado: 'activa',
})

const fromJornada = (j: Jornada): CreateJornadaInput => ({
  sede_id: j.sede_id,
  nombre: j.nombre,
  hora_inicio: j.hora_inicio ?? '',
  hora_fin: j.hora_fin ?? '',
  estado: j.estado,
})

const JornadaFormDialog: FC<{
  show: boolean
  jornada: Jornada | null
  onClose: () => void
}> = ({show, jornada, onClose}) => {
  const intl = useIntl()

  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const {data: sedes} = useSedes(true, true, undefined, true)
  const create = useCreateJornada()
  const update = useUpdateJornada()
  const isEdit = jornada !== null
  const pending = create.isPending || update.isPending

  const [form, setForm] = useState<CreateJornadaInput>(jornada ? fromJornada(jornada) : emptyForm())
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!show) return
    setForm(jornada ? fromJornada(jornada) : emptyForm())
    setError(null)
  }, [show, jornada])

  const fe = (field: string): string | undefined =>
    error?.fieldError(field) ?? (field.endsWith('_id') ? error?.fieldError(`${field.slice(0, -3)}_token`) : undefined)
  const set = (patch: Partial<CreateJornadaInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const input: CreateJornadaInput = {
      ...form,
      nombre: form.nombre.trim(),
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (isEdit && jornada) {
      update.mutate(
        {id: jornada.id, input},
        {
          onSuccess: () => {
            toast.success(t('common.toast.updated'))
            onClose()
          },
          onError,
        }
      )
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success(t('common.toast.created'))
          onClose()
        },
        onError,
      })
    }
  }

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-600px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {isEdit ? t('academico.estructura.jornada.edit') : t('academico.estructura.jornada.create')}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className='modal-body py-lg-10 px-lg-10'>
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('common.field.sede')}
            </label>
            <select
              required
              className={`form-select form-select-solid ${fe('sede_id') ? 'is-invalid' : ''}`}
              value={form.sede_id}
              onChange={(e) => set({sede_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {(sedes?.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {fe('sede_id') && <div className='invalid-feedback'>{fe('sede_id')}</div>}
          </div>

          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.estructura.jornada.nombre')}
            </label>
            <input
              required
              type='text'
              className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
              placeholder={t('academico.estructura.jornada.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
            {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.estructura.jornada.horaInicio')} {t('common.field.optional')}
              </label>
              <input
                type='time'
                className={`form-control form-control-solid ${fe('hora_inicio') ? 'is-invalid' : ''}`}
                value={form.hora_inicio ?? ''}
                onChange={(e) => set({hora_inicio: e.target.value})}
              />
              {form.hora_inicio && <div className='form-text'>{formatSchoolTime(form.hora_inicio)}</div>}
              {fe('hora_inicio') && <div className='invalid-feedback'>{fe('hora_inicio')}</div>}
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.estructura.jornada.horaFin')} {t('common.field.optional')}
              </label>
              <input
                type='time'
                className={`form-control form-control-solid ${fe('hora_fin') ? 'is-invalid' : ''}`}
                value={form.hora_fin ?? ''}
                onChange={(e) => set({hora_fin: e.target.value})}
              />
              {form.hora_fin && <div className='form-text'>{formatSchoolTime(form.hora_fin)}</div>}
              {fe('hora_fin') && <div className='invalid-feedback'>{fe('hora_fin')}</div>}
            </div>
          </div>
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={pending}>
            {pending ? (
              <span className='spinner-border spinner-border-sm align-middle'></span>
            ) : (
              isEdit ? t('common.save', {name: t('entity.jornada')}) : t('academico.estructura.jornada.create')
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const JornadasTab: FC = () => {
  const intl = useIntl()

  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const listQuery = useEstructuraList<Jornada>('jornadas')
  const {isLoading, isError} = listQuery
  const {data: sedes} = useSedes(true, true, undefined, true)
  const del = useDeleteJornada()

  const [formOpen, setFormOpen] = useState(false)
  const [edit, setEdit] = useState<Jornada | null>(null)
  const [deleteId, setDeleteId] = useState<Jornada | null>(null)

  const list = listQuery.rows

  return (
    <>
      <div className='d-flex justify-content-end mb-4'>
        <button
          type='button'
          className='btn btn-primary'
          onClick={() => {
            setEdit(null)
            setFormOpen(true)
          }}
        >
          <i className='ki-duotone ki-plus fs-2'></i>
          {t('academico.estructura.jornada.new')}
        </button>
      </div>

      <AcademicListFilters search={listQuery.searchInput} onSearchChange={listQuery.setSearchInput}>
        <select className='form-select form-select-solid w-auto' aria-label={t('common.field.sede')} value={listQuery.filters.sede_id ?? ''} onChange={event => listQuery.setFilter('sede_id', event.target.value)}>
          <option value=''>{t('academic.filter.allCampuses')}</option>
          {(sedes?.data ?? []).map(sede => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
        </select>
        <select className='form-select form-select-solid w-auto' aria-label={t('common.status')} value={listQuery.filters.estado ?? ''} onChange={event => listQuery.setFilter('estado', event.target.value)}>
          <option value=''>{t('academic.filter.allStatuses')}</option>
          <option value='activa'>{t('common.active')}</option>
          <option value='inactiva'>{t('common.inactive')}</option>
        </select>
      </AcademicListFilters>

      {isLoading && (
        <div className='d-flex justify-content-center align-items-center py-15'>
          <span className='spinner-border text-primary me-3' role='status'></span>
          <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.jornada'})})}</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className='alert alert-danger d-flex align-items-center my-5'>
          <i className='ki-duotone ki-information fs-2 text-danger me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.jornada'})})}</span>
        </div>
      )}

      {!isLoading && !isError && (
        <div className='table-responsive'>
          <table className='table table-row-dashed align-middle gs-0 gy-4'>
            <thead>
              <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                <th className='min-w-150px'>{t('academico.estructura.jornada.nombre')}</th>
                <th className='min-w-120px'>{t('common.field.anoLectivo')}</th>
                <th className='min-w-150px'>{t('common.field.sede')}</th>
                <th className='min-w-150px'>{t('academico.estructura.jornada.horaInicio')}</th>
                <th className='min-w-100px'>{t('common.status')}</th>
                <th className='min-w-150px text-end'>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {list.map((j) => (
                <tr key={j.id}>
                  <td>
                    <span className='text-gray-800 fw-bold'>{j.nombre}</span>
                  </td>
                  <AcademicYearCell yearId={j.ano_lectivo_id} />
                  <td>
                    <span className='text-gray-700'>{j.sede?.nombre ?? '—'}</span>
                  </td>
                  <td>
                    <span className='text-gray-700'>
                      {j.hora_inicio ? `${formatSchoolTime(j.hora_inicio)} – ${formatSchoolTime(j.hora_fin)}` : '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        j.estado === 'activa'
                          ? 'badge badge-light-success'
                          : 'badge badge-light-secondary'
                      }
                    >
                      {t(
                        j.estado === 'activa'
                          ? 'common.active'
                          : 'common.inactive'
                      )}
                    </span>
                  </td>
                  <td>
                    <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                      <button
                        type='button'
                        className='btn btn-icon btn-light-primary btn-sm'
                        title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.jornada'})})}
                        onClick={() => {
                          setEdit(j)
                          setFormOpen(true)
                        }}
                      >
                        <i className='ki-duotone ki-pencil fs-5'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                        </i>
                      </button>
                      <button
                        type='button'
                        className='btn btn-icon btn-light-danger btn-sm'
                        title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.jornada'})})}
                        onClick={() => setDeleteId(j)}
                      >
                        <i className='ki-duotone ki-trash fs-5'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                          <span className='path4'></span>
                          <span className='path5'></span>
                        </i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className='text-center text-muted py-10'>
                    {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.jornada'})})}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AcademicPagination meta={listQuery.meta} visibleCount={list.length} loading={listQuery.isFetching} onPageChange={listQuery.onPageChange} onPerPageChange={listQuery.onPerPageChange} />

      <JornadaFormDialog
        show={formOpen}
        jornada={edit}
        onClose={() => {
          setFormOpen(false)
          setEdit(null)
        }}
      />
      <DeleteConfirmDialog
        show={deleteId !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={del.isPending}
        onConfirm={() => {
          if (!deleteId) return
          del.mutate(deleteId.id, {
            onSuccess: () => {
              toast.success(t('common.toast.deleted'))
              setDeleteId(null)
            },
            onError: () => {
              toast.error(t('common.toast.deleteError'))
              setDeleteId(null)
            },
          })
        }}
        onClose={() => setDeleteId(null)}
      />
    </>
  )
}

export {JornadasTab}
