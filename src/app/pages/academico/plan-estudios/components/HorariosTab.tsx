import {FC, useEffect, useMemo, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {Link} from 'react-router-dom'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {useToast} from '@/lib/ui/toast'
import {useAnosLectivos} from '../../anos-lectivos/anos-lectivos.api'
import {
  useBloquesHorarios,
  useEspaciosFisicos,
  useGrados,
  useGrupos,
  useJornadas,
  useNiveles,
  useSedes,
} from '../../estructura/estructura.api'
import {useUsuarios} from '../../../usuarios/usuarios.api'
import {DeleteConfirmDialog} from '../../estructura/components/DeleteConfirmDialog'
import {crearSesion, eliminarSesion, usePlanEstudiosStore} from '../plan-estudios.store'
import {DIAS_SEMANA, type AsignacionDocente, type DiaSemana, type SesionHorario} from '../plan-estudios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

interface SesionFormDialogProps {
  show: boolean
  dia: DiaSemana
  bloqueHorarioId: string
  grupoId: string
  asignaciones: AsignacionDocente[]
  espacios: Array<{id: string; nombre: string}>
  docenteNombre: (id: string) => string
  materiaNombre: (id: string) => string
  onClose: () => void
}

const SesionFormDialog: FC<SesionFormDialogProps> = ({
  show,
  dia,
  bloqueHorarioId,
  grupoId,
  asignaciones,
  espacios,
  docenteNombre,
  materiaNombre,
  onClose,
}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const [asignacionId, setAsignacionId] = useState('')
  const [espacioId, setEspacioId] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const asignacion = asignaciones.find((a) => a.id === asignacionId)
    if (!asignacion) return

    const {sesion, conflictos} = crearSesion(
      {
        asignacion_id: asignacion.id,
        dia,
        bloque_horario_id: bloqueHorarioId,
        espacio_fisico_id: espacioId || null,
      },
      {grupoId, docenteId: asignacion.docente_id}
    )

    if (!sesion) {
      const mensaje = conflictos.map((tipo) => t(`academico.planEstudios.conflicto.${tipo}`)).join(' ')
      toast.error(mensaje)
      return
    }
    toast.success(t('common.toast.created'))
    onClose()
  }

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{t('academico.planEstudios.horario.agregar')}</h2>
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
              {t('academico.planEstudios.horario.asignacionLabel')}
            </label>
            <select
              className='form-select form-select-solid'
              value={asignacionId}
              onChange={(e) => setAsignacionId(e.target.value)}
            >
              <option value=''>{t('common.select')}</option>
              {asignaciones.map((a) => (
                <option key={a.id} value={a.id}>
                  {materiaNombre(a.materia_id)} — {docenteNombre(a.docente_id)}
                </option>
              ))}
            </select>
            {asignaciones.length === 0 && (
              <div className='text-muted fs-8 mt-2'>{t('academico.planEstudios.horario.sinAsignaciones')}</div>
            )}
          </div>

          <div className='fv-row'>
            <label className='fs-6 fw-semibold mb-2'>{t('academico.planEstudios.horario.espacioLabel')}</label>
            <select
              className='form-select form-select-solid'
              value={espacioId}
              onChange={(e) => setEspacioId(e.target.value)}
            >
              <option value=''>{t('common.select')}</option>
              {espacios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={asignaciones.length === 0}>
            {intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.sesionHorario'})})}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

const HorariosTab: FC = () => {
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

  const {data: grupos} = useGrupos(anoLectivoId)
  const gruposList = grupos?.data ?? []
  const {data: sedes} = useSedes()
  const {data: jornadas} = useJornadas()
  const {data: niveles} = useNiveles()
  const {data: grados} = useGrados()
  const [sedeId, setSedeId] = useState('')
  const [jornadaId, setJornadaId] = useState('')
  const [nivelId, setNivelId] = useState('')
  const [gradoId, setGradoId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const jornadasFiltradas = (jornadas?.data ?? []).filter((j) => !sedeId || j.sede_id === sedeId)
  const gradosFiltrados = (grados?.data ?? []).filter((g) => !nivelId || g.nivel_id === nivelId)
  const gruposFiltrados = gruposList.filter(
    (g) =>
      (!sedeId || g.sede_id === sedeId) &&
      (!jornadaId || g.jornada_id === jornadaId) &&
      (!nivelId || g.grado?.nivel?.id === nivelId) &&
      (!gradoId || g.grado_id === gradoId)
  )
  const grupo = gruposFiltrados.find((g) => g.id === grupoId) ?? null

  const {data: bloques} = useBloquesHorarios(grupo?.jornada_id ?? undefined)
  const bloquesOrdenados = [...(bloques?.data ?? [])].sort((a, b) => a.orden - b.orden)

  const {data: espacios} = useEspaciosFisicos(grupo?.sede_id ?? undefined)
  const {data: usuarios} = useUsuarios(1, 100)

  const {materias, asignaciones, sesiones} = usePlanEstudiosStore()
  const asignacionesDelGrupo = asignaciones.filter(
    (a) => a.grupo_id === grupoId && a.ano_lectivo_id === anoLectivoId
  )
  const asignacionIdsDelGrupo = new Set(asignacionesDelGrupo.map((a) => a.id))
  const sesionesDelGrupo = sesiones.filter((s) => asignacionIdsDelGrupo.has(s.asignacion_id))

  const [celda, setCelda] = useState<{dia: DiaSemana; bloqueHorarioId: string} | null>(null)
  const [deleteSesion, setDeleteSesion] = useState<SesionHorario | null>(null)

  const docenteNombre = (id: string) => (usuarios?.data ?? []).find((u) => u.id === id)?.name ?? '—'
  const materiaNombre = (id: string) => materias.find((m) => m.id === id)?.nombre ?? '—'

  const sesionEn = (dia: DiaSemana, bloqueHorarioId: string) =>
    sesionesDelGrupo.find((s) => s.dia === dia && s.bloque_horario_id === bloqueHorarioId) ?? null

  const noYears = anosList.length === 0

  return (
    <>
      <div className='d-flex flex-column flex-md-row flex-wrap gap-4 mb-6'>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>{t('common.field.anoLectivo')}</label>
          <select
            className='form-select form-select-solid w-md-250px'
            value={anoLectivoId}
            disabled={noYears}
            onChange={(e) => {
              setAnoLectivoId(e.target.value)
              setSedeId('')
              setJornadaId('')
              setNivelId('')
              setGradoId('')
              setGrupoId('')
            }}
          >
            {anosList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
            {noYears && <option value=''>—</option>}
          </select>
        </div>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>Sede</label>
          <select
            className='form-select form-select-solid w-md-200px'
            value={sedeId}
            onChange={(e) => {
              setSedeId(e.target.value)
              setJornadaId('')
              setGrupoId('')
            }}
          >
            <option value=''>Todas las sedes</option>
            {(sedes?.data ?? []).filter((s) => s.estado === 'activo').map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>Jornada</label>
          <select
            className='form-select form-select-solid w-md-200px'
            value={jornadaId}
            onChange={(e) => {
              setJornadaId(e.target.value)
              setGrupoId('')
            }}
          >
            <option value=''>Todas las jornadas</option>
            {jornadasFiltradas.filter((j) => j.estado === 'activo').map((j) => (
              <option key={j.id} value={j.id}>{j.nombre}</option>
            ))}
          </select>
        </div>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>Nivel</label>
          <select
            className='form-select form-select-solid w-md-200px'
            value={nivelId}
            onChange={(e) => {
              setNivelId(e.target.value)
              setGradoId('')
              setGrupoId('')
            }}
          >
            <option value=''>Todos los niveles</option>
            {(niveles?.data ?? []).filter((n) => n.estado === 'activo').map((n) => (
              <option key={n.id} value={n.id}>{n.nombre}</option>
            ))}
          </select>
        </div>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>Grado</label>
          <select
            className='form-select form-select-solid w-md-200px'
            value={gradoId}
            onChange={(e) => {
              setGradoId(e.target.value)
              setGrupoId('')
            }}
          >
            <option value=''>Todos los grados</option>
            {gradosFiltrados.filter((g) => g.estado === 'activo').map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        </div>
        <div className='d-flex flex-column'>
          <label className='fs-8 fw-semibold text-muted mb-1'>{t('academico.planEstudios.horario.grupoLabel')}</label>
          <select
            className='form-select form-select-solid w-md-250px'
            value={grupoId}
            disabled={noYears || gruposFiltrados.length === 0}
            onChange={(e) => setGrupoId(e.target.value)}
          >
            <option value=''>{t('common.select')}</option>
            {gruposFiltrados.map((g) => (
              <option key={g.id} value={g.id}>
                {g.grado?.nombre ? `${g.grado.nombre} / ` : ''}
                {g.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!grupo && (
        <div className='alert alert-warning d-flex align-items-center'>
          <i className='ki-duotone ki-information fs-2 text-warning me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <div className='d-flex flex-column flex-md-row align-items-md-center gap-3 w-100'>
            <span>
              {noYears
                ? t('academico.planEstudios.resumen.noYears')
                : gruposList.length === 0
                  ? 'Aún no hay grupos para este año lectivo. Crea primero el grado y su grupo para construir su horario.'
                  : 'Selecciona un grupo para consultar o construir su horario semanal.'}
            </span>
            {!noYears && gruposList.length === 0 && (
              <Link to='/academico/estructura?tab=grupos' className='btn btn-sm btn-warning ms-md-auto text-nowrap'>
                <i className='ki-duotone ki-plus fs-5'></i>
                Crear grupo
              </Link>
            )}
          </div>
        </div>
      )}

      {grupo && !grupo.jornada_id && (
        <div className='alert alert-warning d-flex align-items-center'>
          <i className='ki-duotone ki-information fs-2 text-warning me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{t('academico.planEstudios.horario.sinJornada')}</span>
        </div>
      )}

      {grupo && grupo.jornada_id && bloquesOrdenados.length === 0 && (
        <div className='alert alert-warning d-flex align-items-center'>
          <i className='ki-duotone ki-information fs-2 text-warning me-3'>
            <span className='path1'></span>
            <span className='path2'></span>
            <span className='path3'></span>
          </i>
          <span>{t('academico.planEstudios.horario.sinBloques')}</span>
        </div>
      )}

      {grupo && grupo.jornada_id && bloquesOrdenados.length > 0 && (
        <div className='table-responsive'>
          <table className='table table-bordered align-middle gs-0 gy-2'>
            <thead>
              <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                <th className='min-w-120px'>{t('academico.planEstudios.horario.bloqueLabel')}</th>
                {DIAS_SEMANA.map((dia) => (
                  <th key={dia} className='min-w-150px'>
                    {t(`academico.dia.${dia}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='text-gray-600 fw-semibold'>
              {bloquesOrdenados.map((bloque) =>
                bloque.es_descanso ? (
                  <tr key={bloque.id}>
                    <td className='text-gray-800 fw-bold'>{bloque.nombre}</td>
                    <td colSpan={DIAS_SEMANA.length} className='text-center text-muted bg-light-warning'>
                      {t('academico.planEstudios.horario.descanso')}
                    </td>
                  </tr>
                ) : (
                  <tr key={bloque.id}>
                    <td className='text-gray-800 fw-bold'>
                      {bloque.nombre}
                      <div className='text-muted fs-8'>
                        {bloque.hora_inicio} - {bloque.hora_fin}
                      </div>
                    </td>
                    {DIAS_SEMANA.map((dia) => {
                      const sesion = sesionEn(dia, bloque.id)
                      const asignacion = sesion
                        ? asignacionesDelGrupo.find((a) => a.id === sesion.asignacion_id)
                        : null
                      return (
                        <td key={dia}>
                          {sesion && asignacion ? (
                            <div className='d-flex align-items-center justify-content-between bg-light-primary rounded p-2'>
                              <div>
                                <div className='fw-bold text-gray-800 fs-8'>{materiaNombre(asignacion.materia_id)}</div>
                                <div className='text-muted fs-9'>{docenteNombre(asignacion.docente_id)}</div>
                              </div>
                              <button
                                type='button'
                                className='btn btn-icon btn-sm btn-light-danger'
                                title={intl.formatMessage(
                                  {id: 'common.delete'},
                                  {name: intl.formatMessage({id: 'entity.sesionHorario'})}
                                )}
                                onClick={() => setDeleteSesion(sesion)}
                              >
                                <i className='ki-duotone ki-cross fs-6'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                            </div>
                          ) : (
                            <button
                              type='button'
                              className='btn btn-sm btn-light w-100'
                              onClick={() => setCelda({dia, bloqueHorarioId: bloque.id})}
                            >
                              <i className='ki-duotone ki-plus fs-4'></i>
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {celda && grupo && (
        <SesionFormDialog
          show={celda !== null}
          dia={celda.dia}
          bloqueHorarioId={celda.bloqueHorarioId}
          grupoId={grupo.id}
          asignaciones={asignacionesDelGrupo}
          espacios={espacios?.data ?? []}
          docenteNombre={docenteNombre}
          materiaNombre={materiaNombre}
          onClose={() => setCelda(null)}
        />
      )}

      <DeleteConfirmDialog
        show={deleteSesion !== null}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={false}
        onClose={() => setDeleteSesion(null)}
        onConfirm={() => {
          if (!deleteSesion) return
          eliminarSesion(deleteSesion.id)
          toast.success(t('common.toast.deleted'))
          setDeleteSesion(null)
        }}
      />
    </>
  )
}

export {HorariosTab}
