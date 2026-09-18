import {FC, useEffect, useMemo, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {useToast} from '@/lib/ui/toast'
import {useAnosLectivos} from '../../anos-lectivos/anos-lectivos.api'
import {useGrupos} from '../../estructura/estructura.api'
import {useUsuarios} from '../../../usuarios/usuarios.api'
import {DeleteConfirmDialog} from '../../estructura/components/DeleteConfirmDialog'
import {crearAsignacion, eliminarAsignacion, usePlanEstudiosStore} from '../plan-estudios.store'
import type {AsignacionDocente, CreateAsignacionInput} from '../plan-estudios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

const AsignacionFormDialog: FC<{
  show: boolean
  anoLectivoId: string
  onClose: () => void
}> = ({show, anoLectivoId, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {materias} = usePlanEstudiosStore()
  const materiasActivas = materias.filter((m) => m.estado === 'activo')
  const {data: grupos} = useGrupos(anoLectivoId)
  const {data: usuarios} = useUsuarios(1, 100)
  const docentes = (usuarios?.data ?? []).filter((u) => u.role === 'docente')

  const [form, setForm] = useState<CreateAsignacionInput>({
    docente_id: '',
    materia_id: '',
    grupo_id: '',
    ano_lectivo_id: anoLectivoId,
  })
  const set = (patch: Partial<CreateAsignacionInput>) => setForm((prev) => ({...prev, ...patch}))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.docente_id || !form.materia_id || !form.grupo_id) return

    const asignacion = crearAsignacion(form)
    if (!asignacion) {
      toast.error(t('academico.planEstudios.asignacion.duplicada'))
      return
    }
    toast.success(t('common.toast.created'))
    onClose()
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
        <h2 className='fw-bold'>{t('academico.estructura.create.title')}</h2>
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
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.planEstudios.asignacion.docente')}</label>
            <select
              className='form-select form-select-solid'
              value={form.docente_id}
              onChange={(e) => set({docente_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {docentes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {docentes.length === 0 && (
              <div className='text-muted fs-8 mt-2'>{t('academico.planEstudios.asignacion.noDocentes')}</div>
            )}
          </div>

          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.planEstudios.asignacion.materia')}</label>
            <select
              className='form-select form-select-solid'
              value={form.materia_id}
              onChange={(e) => set({materia_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {materiasActivas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            {materiasActivas.length === 0 && (
              <div className='text-muted fs-8 mt-2'>{t('academico.planEstudios.asignacion.noMaterias')}</div>
            )}
          </div>

          <div className='fv-row'>
            <label className='required fs-6 fw-semibold mb-2'>{t('academico.planEstudios.asignacion.grupo')}</label>
            <select
              className='form-select form-select-solid'
              value={form.grupo_id}
              onChange={(e) => set({grupo_id: e.target.value})}
            >
              <option value=''>{t('common.select')}</option>
              {(grupos?.data ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grado?.nombre ? `${g.grado.nombre} / ` : ''}
                  {g.nombre}
                </option>
              ))}
            </select>
            {(grupos?.data ?? []).length === 0 && (
              <div className='text-muted fs-8 mt-2'>{t('academico.planEstudios.asignacion.noGrupos')}</div>
            )}
          </div>
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary'>
            {intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.asignacionDocente'})})}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const AsignacionesTab: FC = () => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()

  const {data: anos} = useAnosLectivos()
  const anosList = useMemo(() => anos?.data ?? [], [anos])
  const [anoLectivoId, setAnoLectivoId] = useState('')

  useEffect(() => {
    if (anoLectivoId || anosList.length === 0) return
    const enCurso = anosList.find((a) => a.estado === 'en_curso')
    setAnoLectivoId((enCurso ?? anosList[0]).id)
  }, [anosList, anoLectivoId])

  const {materias, asignaciones} = usePlanEstudiosStore()
  const {data: grupos} = useGrupos(anoLectivoId)
  const {data: usuarios} = useUsuarios(1, 100)

  const [formOpen, setFormOpen] = useState(false)
  const [deleteAsignacion, setDeleteAsignacion] = useState<AsignacionDocente | null>(null)

  const asignacionesDelAno = asignaciones.filter((a) => a.ano_lectivo_id === anoLectivoId)
  const noYears = anosList.length === 0

  const docenteNombre = (id: string) => (usuarios?.data ?? []).find((u) => u.id === id)?.name ?? '—'
  const materiaNombre = (id: string) => materias.find((m) => m.id === id)?.nombre ?? '—'
  const grupoNombre = (id: string) => {
    const g = (grupos?.data ?? []).find((g) => g.id === id)
    if (!g) return '—'
    return g.grado?.nombre ? `${g.grado.nombre} / ${g.nombre}` : g.nombre
  }

  return (
    <>
      <div className='d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4 mb-6'>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>{t('common.field.anoLectivo')}</label>
          <select
            className='form-select form-select-solid w-md-250px'
            value={anoLectivoId}
            disabled={noYears}
            onChange={(e) => setAnoLectivoId(e.target.value)}
          >
            {anosList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
            {noYears && <option value=''>—</option>}
          </select>
        </div>
        <button type='button' className='btn btn-primary' disabled={noYears} onClick={() => setFormOpen(true)}>
          <i className='ki-duotone ki-plus fs-2'></i>
          {t('academico.planEstudios.asignacion.new')}
        </button>
      </div>

      {noYears ? (
        <div className='alert alert-warning d-flex align-items-center'>
          <i className='ki-duotone ki-information fs-2 text-warning me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{t('academico.planEstudios.resumen.noYears')}</span>
        </div>
      ) : (
        <div className='table-responsive'>
          <table className='table table-row-dashed align-middle gs-0 gy-4'>
            <thead>
              <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                <th className='min-w-150px'>{t('academico.planEstudios.asignacion.col.docente')}</th>
                <th className='min-w-150px'>{t('academico.planEstudios.asignacion.col.materia')}</th>
                <th className='min-w-150px'>{t('academico.planEstudios.asignacion.col.grupo')}</th>
                <th className='min-w-100px text-end'>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {asignacionesDelAno.map((a) => (
                <tr key={a.id}>
                  <td className='text-gray-800 fw-bold'>{docenteNombre(a.docente_id)}</td>
                  <td>{materiaNombre(a.materia_id)}</td>
                  <td>{grupoNombre(a.grupo_id)}</td>
                  <td>
                    <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                      <button
                        type='button'
                        className='btn btn-icon btn-light-danger btn-sm'
                        title={intl.formatMessage(
                          {id: 'common.delete'},
                          {name: intl.formatMessage({id: 'entity.asignacionDocente'})}
                        )}
                        onClick={() => setDeleteAsignacion(a)}
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
              {asignacionesDelAno.length === 0 && (
                <tr>
                  <td colSpan={4} className='text-center text-muted py-10'>
                    {t('academico.planEstudios.asignacion.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <AsignacionFormDialog show={formOpen} anoLectivoId={anoLectivoId} onClose={() => setFormOpen(false)} />
      )}

      <DeleteConfirmDialog
        show={deleteAsignacion !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={false}
        onClose={() => setDeleteAsignacion(null)}
        onConfirm={() => {
          if (!deleteAsignacion) return
          eliminarAsignacion(deleteAsignacion.id)
          toast.success(t('common.toast.deleted'))
          setDeleteAsignacion(null)
        }}
      />
    </>
  )
}

export {AsignacionesTab}
