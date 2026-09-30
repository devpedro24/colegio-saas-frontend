import {FC, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {ApiError} from '@/lib/api/client'
import {AcademicYearCell, useAcademicYear} from '../../academic-year-context'
import {useNiveles} from '../../estructura/estructura.api'
import {useAcademicPagedList} from '../../estructura/useAcademicPagedList'
import {AcademicListFilters} from '../../estructura/components/AcademicListFilters'
import {DeleteConfirmDialog} from '../../estructura/components/DeleteConfirmDialog'
import {
  useCreatePlanArea,
  useCreatePlanMateria,
  useAllPlanAreas,
  useDeletePlanArea,
  useDeletePlanMateria,
  usePlanAreas,
  getPlanAreasPage,
  getPlanMateriasPage,
  useUpdatePlanArea,
  useUpdatePlanMateria,
} from '../plan-estudios.api'
import type {Area, CreateAreaInput, CreateMateriaInput, Materia} from '../plan-estudios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

// ---- Área ----

const emptyAreaForm = (): CreateAreaInput => ({nombre: '', descripcion: '', estado: 'activo'})
const fromArea = (a: Area): CreateAreaInput => ({nombre: a.nombre, descripcion: a.descripcion ?? '', estado: a.estado})

const AreaFormDialog: FC<{show: boolean; area: Area | null; onClose: () => void}> = ({show, area, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreatePlanArea()
  const update = useUpdatePlanArea()
  const isEdit = area !== null
  const [form, setForm] = useState<CreateAreaInput>(area ? fromArea(area) : emptyAreaForm())
  const set = (patch: Partial<CreateAreaInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const input: CreateAreaInput = {...form, nombre: form.nombre.trim(), descripcion: form.descripcion?.trim() || null}
    if (!input.nombre) return

    try {
      if (isEdit && area) {
        await update.mutateAsync({id: area.id, input})
        toast.success(t('common.toast.updated'))
      } else {
        await create.mutateAsync(input)
        toast.success(t('common.toast.created'))
      }
      onClose()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('common.toast.saveError'))
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
          {isEdit ? t('academico.estructura.edit.title') : t('academico.estructura.create.title')}
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
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.planEstudios.area.nombre')}</label>
            <input
              type='text'
              required
              className='form-control form-control-solid'
              placeholder={t('academico.planEstudios.area.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
          </div>
          <div className='fv-row'>
            <label className='fs-6 fw-semibold mb-2'>{t('academico.planEstudios.area.descripcion')} {t('common.field.optional')}</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder={t('academico.planEstudios.area.descripcionPh')}
              value={form.descripcion ?? ''}
              onChange={(e) => set({descripcion: e.target.value})}
            />
          </div>
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={create.isPending || update.isPending}>
            {intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.area'})})}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

// ---- Materia ----

const emptyMateriaForm = (): CreateMateriaInput => ({
  area_id: '',
  nombre: '',
  intensidad_horaria: 1,
  nivel_id: null,
  estado: 'activo',
})
const fromMateria = (m: Materia): CreateMateriaInput => ({
  area_id: m.area_id,
  nombre: m.nombre,
  intensidad_horaria: m.intensidad_horaria,
  nivel_id: m.nivel_id,
  estado: m.estado,
})

const MateriaFormDialog: FC<{show: boolean; materia: Materia | null; onClose: () => void}> = ({
  show,
  materia,
  onClose,
}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreatePlanMateria()
  const update = useUpdatePlanMateria()
  const {data: niveles} = useNiveles()
  const areaOptionsQuery = useAllPlanAreas(show)
  const foundAreas = areaOptionsQuery.areas
  const selectedArea = materia?.area ? [{id: materia.area.id, nombre: materia.area.nombre}] : []
  const areaOptions = [...selectedArea, ...foundAreas.filter(area => area.id !== materia?.area_id)]
  const isEdit = materia !== null
  const [form, setForm] = useState<CreateMateriaInput>(materia ? fromMateria(materia) : emptyMateriaForm())
  const set = (patch: Partial<CreateMateriaInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
      const input: CreateMateriaInput = {
      ...form,
      nombre: form.nombre.trim(),
      intensidad_horaria: Number(form.intensidad_horaria) || 0,
    }

    try {
      if (isEdit && materia) {
        await update.mutateAsync({id: materia.id, input})
        toast.success(t('common.toast.updated'))
      } else {
        await create.mutateAsync(input)
        toast.success(t('common.toast.created'))
      }
      onClose()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('common.toast.saveError'))
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
          {isEdit ? t('academico.estructura.edit.title') : t('academico.estructura.create.title')}
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
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.planEstudios.materia.area')}</label>
            <select
              required
              className='form-select form-select-solid'
              value={form.area_id}
              onChange={(e) => set({area_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {areaOptionsQuery.isFetching && foundAreas.length === 0 && <option value='' disabled>{t('common.pleaseWait')}</option>}
              {areaOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.planEstudios.materia.nombre')}</label>
            <input
              type='text'
              required
              className='form-control form-control-solid'
              placeholder={t('academico.planEstudios.materia.nombrePh')}
              value={form.nombre}
              onChange={(e) => set({nombre: e.target.value})}
            />
          </div>

          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>
                {t('academico.planEstudios.materia.intensidad')}
              </label>
              <input
                type='number'
                required
                min={1}
                max={40}
                className='form-control form-control-solid'
                value={form.intensidad_horaria}
                onChange={(e) => set({intensidad_horaria: Number(e.target.value)})}
              />
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='fs-6 fw-semibold mb-2'>{t('academico.planEstudios.materia.nivel')} {t('common.field.optional')}</label>
              <select
                className='form-select form-select-solid'
                value={form.nivel_id ?? ''}
                onChange={(e) => set({nivel_id: e.target.value || null})}
              >
                <option value=''>{t('academico.nivel.todos')}</option>
                {(niveles?.data ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={create.isPending || update.isPending}>
            {intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.materia'})})}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

// ---- Tab ----

const AreasMateriasTab: FC = () => {
  const intl = useIntl()
  const {yearId} = useAcademicYear()

  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const {data: niveles} = useNiveles()
  const [areaFilterOpen, setAreaFilterOpen] = useState(false)
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<Area | null>(null)
  const {data: firstFilterAreas = []} = usePlanAreas()
  const allFilterAreas = useAllPlanAreas(areaFilterOpen)
  const filterAreas = allFilterAreas.areas.length ? allFilterAreas.areas : firstFilterAreas
  const areaFilterOptions = selectedAreaFilter ? [selectedAreaFilter, ...filterAreas.filter(area => area.id !== selectedAreaFilter.id)] : filterAreas
  const areaList = useAcademicPagedList<Area>({
    key: ['plan-estudios', 'areas', yearId], storageKey: 'plan.areas', enabled: !!yearId,
    fetchPage: (page, perPage, search, filters) => getPlanAreasPage(yearId, {page, perPage, search, filters}),
  })
  const materiaList = useAcademicPagedList<Materia>({
    key: ['plan-estudios', 'materias', yearId], storageKey: 'plan.materias', enabled: !!yearId,
    fetchPage: (page, perPage, search, filters) => getPlanMateriasPage(yearId, {page, perPage, search, filters}),
  })
  const areas = areaList.rows
  const materias = materiaList.rows
  const deleteAreaMutation = useDeletePlanArea()
  const deleteMateriaMutation = useDeletePlanMateria()

  const [areaFormOpen, setAreaFormOpen] = useState(false)
  const [editArea, setEditArea] = useState<Area | null>(null)
  const [deleteArea, setDeleteArea] = useState<Area | null>(null)

  const [materiaFormOpen, setMateriaFormOpen] = useState(false)
  const [editMateria, setEditMateria] = useState<Materia | null>(null)
  const [deleteMateria, setDeleteMateria] = useState<Materia | null>(null)

  const nivelNombre = (nivelId: string | null) => {
    if (!nivelId) return t('academico.nivel.todos')
    return (niveles?.data ?? []).find((n) => String(n.id) === String(nivelId))?.nombre ?? '—'
  }

  return (
    <>
      <section className='pb-8 mb-8 border-bottom' aria-label={t('academico.planEstudios.area.title')}>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-3 mb-5'>
        <h4 className='fw-bold mb-0'>{t('academico.planEstudios.area.title')}</h4>
        <button
          type='button'
          className='btn btn-primary'
          onClick={() => {
            setEditArea(null)
            setAreaFormOpen(true)
          }}
        >
          <i className='ki-duotone ki-plus fs-2'></i>
          {t('academico.planEstudios.area.new')}
        </button>
      </div>
      <AcademicListFilters search={areaList.searchInput} onSearchChange={areaList.setSearchInput}>

        <select className='form-select form-select-solid w-auto' aria-label={t('common.status')} value={areaList.filters.estado ?? ''} onChange={event => areaList.setFilter('estado', event.target.value)}>
          <option value=''>{t('academic.filter.allStatuses')}</option>
          <option value='activo'>{t('common.active')}</option>
          <option value='inactivo'>{t('common.inactive')}</option>
        </select>

      </AcademicListFilters>
      {areaList.isError && <div className='alert alert-danger' role='alert'>{t('common.loadError', {name: intl.formatMessage({id: 'entity.area'})})}</div>}
      <div className='table-responsive'>
        <table className='table table-row-dashed align-middle gs-0 gy-4'>
          <thead>
            <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
              <th className='min-w-150px'>{t('academico.planEstudios.area.nombre')}</th>
              <th className='min-w-120px'>{t('common.field.anoLectivo')}</th>
              <th className='min-w-200px'>{t('academico.planEstudios.area.descripcion')}</th>
              <th className='min-w-100px'>{t('common.status')}</th>
              <th className='min-w-120px text-end'>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className='text-gray-600 fw-semibold'>
            {areas.map((a) => (
              <tr key={a.id}>
                <td className='text-gray-800 fw-bold'>{a.nombre}</td>
                <AcademicYearCell yearId={a.ano_lectivo_id} />
                <td>{a.descripcion ?? '—'}</td>
                <td>
                  <span className={a.estado === 'activo' ? 'badge badge-light-success' : 'badge badge-light-secondary'}>
                    {t(a.estado === 'activo' ? 'common.active' : 'common.inactive')}
                  </span>
                </td>
                <td>
                  <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                    <button
                      type='button'
                      className='btn btn-icon btn-light-primary btn-sm'
                      title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.area'})})}
                      onClick={() => {
                        setEditArea(a)
                        setAreaFormOpen(true)
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
                      title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.area'})})}
                      onClick={() => setDeleteArea(a)}
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
            {areas.length === 0 && (
              <tr>
                <td colSpan={5} className='text-center text-muted py-10'>
                  {areaList.isLoading ? t('common.pleaseWait') : t('common.empty', {name: intl.formatMessage({id: 'entity.area'})})}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AcademicPagination meta={areaList.meta} visibleCount={areas.length} loading={areaList.isFetching} onPageChange={areaList.onPageChange} onPerPageChange={areaList.onPerPageChange} onLoadMore={areaList.onLoadMore} />
      </section>

      <section aria-label={t('academico.planEstudios.materia.title')}>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-3 mb-5'>
        <h4 className='fw-bold mb-0'>{t('academico.planEstudios.materia.title')}</h4>
        <button
          type='button'
          className='btn btn-primary'
          onClick={() => {
            setEditMateria(null)
            setMateriaFormOpen(true)
          }}
        >
          <i className='ki-duotone ki-plus fs-2'></i>
          {t('academico.planEstudios.materia.new')}
        </button>
      </div>
      <AcademicListFilters search={materiaList.searchInput} onSearchChange={materiaList.setSearchInput}>

        <select className='form-select form-select-solid w-auto' aria-label={t('academico.planEstudios.materia.area')} value={materiaList.filters.area_id ?? ''} onFocus={() => setAreaFilterOpen(true)} onPointerEnter={() => setAreaFilterOpen(true)} onChange={event => {setSelectedAreaFilter(filterAreas.find(area => String(area.id) === event.target.value) ?? null); materiaList.setFilter('area_id', event.target.value)}}>
          <option value=''>{t('academic.filter.allAreas')}</option>
          {areaFilterOptions.map(area => <option key={area.id} value={area.id}>{area.nombre}</option>)}
        </select>


        <select className='form-select form-select-solid w-auto' aria-label={t('academico.planEstudios.materia.nivel')} value={materiaList.filters.nivel_id ?? ''} onChange={event => materiaList.setFilter('nivel_id', event.target.value)}>
          <option value=''>{t('academico.nivel.todos')}</option>
          {(niveles?.data ?? []).map(nivel => <option key={nivel.id} value={nivel.id}>{nivel.nombre}</option>)}
        </select>


        <select className='form-select form-select-solid w-auto' aria-label={t('common.status')} value={materiaList.filters.estado ?? ''} onChange={event => materiaList.setFilter('estado', event.target.value)}>
          <option value=''>{t('academic.filter.allStatuses')}</option>
          <option value='activo'>{t('common.active')}</option>
          <option value='inactivo'>{t('common.inactive')}</option>
        </select>

      </AcademicListFilters>
      {materiaList.isError && <div className='alert alert-danger' role='alert'>{t('common.loadError', {name: intl.formatMessage({id: 'entity.materia'})})}</div>}
      <div className='table-responsive'>
        <table className='table table-row-dashed align-middle gs-0 gy-4'>
          <thead>
            <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
              <th className='min-w-150px'>{t('academico.planEstudios.materia.nombre')}</th>
              <th className='min-w-120px'>{t('common.field.anoLectivo')}</th>
              <th className='min-w-150px'>{t('academico.planEstudios.materia.area')}</th>
              <th className='min-w-120px'>{t('academico.planEstudios.materia.intensidad')}</th>
              <th className='min-w-150px'>{t('academico.planEstudios.materia.nivel')}</th>
              <th className='min-w-100px'>{t('common.status')}</th>
              <th className='min-w-120px text-end'>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className='text-gray-600 fw-semibold'>
            {materias.map((m) => (
              <tr key={m.id}>
                <td className='text-gray-800 fw-bold'>{m.nombre}</td>
                <AcademicYearCell yearId={m.ano_lectivo_id} />
                <td>{m.area?.nombre ?? '—'}</td>
                <td>{m.intensidad_horaria}</td>
                <td>{nivelNombre(m.nivel_id)}</td>
                <td>
                  <span className={m.estado === 'activo' ? 'badge badge-light-success' : 'badge badge-light-secondary'}>
                    {t(m.estado === 'activo' ? 'common.active' : 'common.inactive')}
                  </span>
                </td>
                <td>
                  <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                    <button
                      type='button'
                      className='btn btn-icon btn-light-primary btn-sm'
                      title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.materia'})})}
                      onClick={() => {
                        setEditMateria(m)
                        setMateriaFormOpen(true)
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
                      title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.materia'})})}
                      onClick={() => setDeleteMateria(m)}
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
            {materias.length === 0 && (
              <tr>
                <td colSpan={7} className='text-center text-muted py-10'>
                  {materiaList.isLoading ? t('common.pleaseWait') : t('common.empty', {name: intl.formatMessage({id: 'entity.materia'})})}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AcademicPagination meta={materiaList.meta} visibleCount={materias.length} loading={materiaList.isFetching} onPageChange={materiaList.onPageChange} onPerPageChange={materiaList.onPerPageChange} onLoadMore={materiaList.onLoadMore} />
      </section>

      {areaFormOpen && (
        <AreaFormDialog show={areaFormOpen} area={editArea} onClose={() => setAreaFormOpen(false)} />
      )}
      {materiaFormOpen && (
        <MateriaFormDialog
          show={materiaFormOpen}
          materia={editMateria}
          onClose={() => setMateriaFormOpen(false)}
        />
      )}

      <DeleteConfirmDialog
        show={deleteArea !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={deleteAreaMutation.isPending}
        onClose={() => setDeleteArea(null)}
        onConfirm={async () => {
          if (!deleteArea) return
          try {
            await deleteAreaMutation.mutateAsync(deleteArea.id)
            toast.success(t('common.toast.deleted'))
            setDeleteArea(null)
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : t('common.toast.deleteError'))
          }
        }}
      />
      <DeleteConfirmDialog
        show={deleteMateria !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={deleteMateriaMutation.isPending}
        onClose={() => setDeleteMateria(null)}
        onConfirm={async () => {
          if (!deleteMateria) return
          try {
            await deleteMateriaMutation.mutateAsync(deleteMateria.id)
            toast.success(t('common.toast.deleted'))
            setDeleteMateria(null)
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : t('common.toast.deleteError'))
          }
        }}
      />
    </>
  )
}

export {AreasMateriasTab}
