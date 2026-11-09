import {useSedeMessages} from './useSedeMessages'
﻿import {FC, useState} from 'react'
import {useIntl} from 'react-intl'
import {useNavigate} from 'react-router-dom'
import {api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {
  sedeSubdomainUrl,
  useDeleteSede,
} from '../../estructura/estructura.api'
import type {AcademicPaged} from '../../estructura/estructura.api'
import type {Sede} from '../../estructura/estructura.types'
import {AcademicListFilters} from '../../estructura/components/AcademicListFilters'
import {useAcademicPagedList} from '../../estructura/useAcademicPagedList'
import {DeleteConfirmDialog} from '../../estructura/components/DeleteConfirmDialog'
import {SedeFormDialog} from './SedeFormDialog'
import {fromOpaqueAcademic} from '../../shared/opaqueAcademic'
import {useAuthz} from '@/app/modules/auth/core/authz'

const SedesConfigTab: FC = () => {
  const {hasFeature} = useAuthz()
  const intl = useIntl()
  const t = useSedeMessages()
  const toast = useToast()
  const navigate = useNavigate()
  const {
    rows: list, meta, searchInput, setSearchInput, filters, setFilter,
    isLoading, isError, isFetching, onPageChange, onPerPageChange,
  } = useAcademicPagedList<Sede>({
    key: ['estructura', 'sedes', 'config'],
    storageKey: 'ajustes-institucionales.sedes',
    enabled: true,
    fetchPage: (page, perPage, search, selectedFilters) => {
      const params = new URLSearchParams({page: String(page), per_page: String(perPage)})
      if (search) params.set('search', search)
      if (selectedFilters.estado) params.set('estado', selectedFilters.estado)
      params.set('opaque', '1')
      return api.get<AcademicPaged<Sede>>(`/estructura/sedes?${params}`)
        .then(result => ({...result, data: fromOpaqueAcademic<Sede[]>(result.data)}))
    },
  })
  const del = useDeleteSede()

  const [formOpen, setFormOpen] = useState(false)
  const [sedeEdit, setSedeEdit] = useState<Sede | null>(null)
  const [deleteId, setDeleteId] = useState<Sede | null>(null)

  const openCreate = () => {
    setSedeEdit(null)
    setFormOpen(true)
  }
  const openEdit = (s: Sede) => {
    setSedeEdit(s)
    setFormOpen(true)
  }

  const onDelete = () => {
    if (!deleteId) return
    del.mutate(deleteId.id, {
      onSuccess: () => {
        toast.success(t('common.toast.deleted'), 'deleted')
        setDeleteId(null)
      },
      onError: () => {
        toast.error(t('common.toast.deleteError'))
      },
    })
  }

  return (
    <>
      <div className='card'>
        <div className='card-header border-0 pt-6'>
          <div className='card-title flex-column align-items-start'>
            <h3 className='fw-bold mb-1'>{t('academico.estructura.tab.sedes')}</h3>
            <span className='text-muted fs-7'>{t('academico.estructura.sede.subtitle')}</span>
          </div>
          <div className='card-toolbar'>
            {hasFeature('multi_sede') && <button type='button' className='btn btn-primary' onClick={openCreate}>
              <i className='ki-duotone ki-plus fs-2'></i>
              {t('academico.estructura.new')}
            </button>}
          </div>
        </div>

        <div className='card-body pt-4'>
          {isLoading && (
            <div className='d-flex justify-content-center align-items-center py-15'>
              <span className='spinner-border text-primary me-3' role='status'></span>
              <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sede'})})}</span>
            </div>
          )}

          {isError && !isLoading && (
            <div className='alert alert-danger d-flex align-items-center my-5'>
              <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                <span className='path1'></span>
                <span className='path2'></span>
                <span className='path3'></span>
              </i>
              <span>{intl.formatMessage({id: 'common.loadError'}, {name: intl.formatMessage({id: 'entity.sede'})})}</span>
            </div>
          )}

          {!isLoading && !isError && (
            <>
            <AcademicListFilters search={searchInput} onSearchChange={setSearchInput}>
              <select
                className='form-select form-select-solid w-auto'
                aria-label={t('common.status')}
                value={filters.estado ?? ''}
                onChange={(event) => setFilter('estado', event.target.value)}
              >
                <option value=''>{t('academic.filter.allStatuses')}</option>
                <option value='activa'>{t('common.active')}</option>
                <option value='inactiva'>{t('common.inactive')}</option>
                <option value='mantenimiento'>{t('sede.maintenance')}</option>
              </select>
            </AcademicListFilters>
            <div className='table-responsive' aria-busy={isFetching}>
              <table className='table table-row-dashed align-middle gs-0 gy-4'>
                <thead>
                  <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                    <th className='min-w-150px'>{t('colegios.sedes.field.name')}</th>
                    <th className='min-w-150px'>{t('academico.sede.detail.coordinador')}</th>
                    <th className='min-w-150px'>{t('common.subdomain')}</th>
                    <th className='min-w-100px'>{t('common.status')}</th>
                    <th className='min-w-150px text-end'>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className='text-gray-600 fw-semibold'>
                  {list.map((s) => {
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className='d-flex align-items-center gap-2'>
                            <span className='text-gray-800 fw-bold'>{s.nombre}</span>
                            {!s.tenant_slug && (
                              <span className='badge badge-light-primary'>
                                {t('colegios.sedes.principal')}
                              </span>
                            )}
                          </div>
                          {s.telefono && <span className='text-muted fs-7'>{s.telefono}</span>}
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            <span className='text-gray-800'>{s.coordinador_name ?? '—'}</span><span className='text-muted fs-7'>{s.coordinador_email}</span>
                          </div>
                        </td>
                        <td>
                          {s.tenant_domain ? (
                            <span className='text-gray-700'>{new URL(sedeSubdomainUrl(s.tenant_domain)).host}</span>
                          ) : (
                            <span className='text-muted'>—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              s.estado === 'activa' ? 'badge badge-light-success' : s.estado === 'mantenimiento' ? 'badge badge-light-warning' : 'badge badge-light-secondary'
                            }
                          >
                            {t(
                              s.estado === 'activa' ? 'common.active' : s.estado === 'mantenimiento' ? 'sede.maintenance' : 'common.inactive'
                            )}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                            <button
                              type='button'
                              className='btn btn-light-primary btn-sm'
                              title={t('academico.sede.open')}
                              onClick={() => navigate(`/ajustes-institucionales/sedes/${s.hashed_id}`)}
                            >
                              {t('academico.sede.open')}
                            </button>
                            <button
                              type='button'
                              className='btn btn-icon btn-light-primary btn-sm'
                              title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.sede'})})}
                              onClick={() => openEdit(s)}
                            >
                              <i className='ki-duotone ki-pencil fs-5'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
                            {!s.principal && <button
                              type='button'
                              className='btn btn-icon btn-light-danger btn-sm'
                              title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.sede'})})}
                              onClick={() => setDeleteId(s)}
                            >
                              <i className='ki-duotone ki-trash fs-5'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                                <span className='path4'></span>
                                <span className='path5'></span>
                              </i>
                            </button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={5} className='text-center text-muted py-10'>
                        {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.sede'})})}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <AcademicPagination
              meta={meta}
              visibleCount={list.length}
              loading={isFetching}
              onPageChange={onPageChange}
              onPerPageChange={onPerPageChange}
            />
            </>
          )}
        </div>
      </div>

      {formOpen && <SedeFormDialog sede={sedeEdit} onClose={() => {setFormOpen(false); setSedeEdit(null)}} />}
      <DeleteConfirmDialog
        show={deleteId !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={del.isPending}
        onConfirm={onDelete}
        onClose={() => setDeleteId(null)}
      />

    </>
  )
}

export {SedesConfigTab}
