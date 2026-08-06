import {FC, useState} from 'react'
import {useIntl} from 'react-intl'
import {useTenantSync} from '@/app/modules/auth/hooks/useTenantSync'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAnosLectivos, useIniciarAnoLectivo} from './anos-lectivos.api'
import type {AnoLectivo} from './anos-lectivos.types'
import {AnoLectivoFormDialog} from './components/AnoLectivoFormDialog'
import {CerrarAnoLectivoDialog} from './components/CerrarAnoLectivoDialog'
import {PeriodosDialog} from './components/PeriodosDialog'

// Estado del ano lectivo -> clase de badge (etiqueta por i18n).
const STATUS_CLASS: Record<string, string> = {
  planificado: 'badge badge-light-secondary',
  en_curso: 'badge badge-light-success',
  cerrado: 'badge badge-light-dark',
  archivado: 'badge badge-light',
}

const toDate = (value: string): string => (value ? value.slice(0, 10) : '')

const AnosLectivosPage: FC = () => {
  const intl = useIntl()
  useTenantSync()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)

  const breadcrumbs: Array<PageLink> = [
    {
      title: t('academico.title'),
      path: '/academico/anos-lectivos',
      isSeparator: false,
      isActive: false,
    },
  ]

  const [formAno, setFormAno] = useState<AnoLectivo | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [cerrando, setCerrando] = useState<AnoLectivo | null>(null)
  const [periodosAno, setPeriodosAno] = useState<AnoLectivo | null>(null)

  const toast = useToast()
  const {data, isLoading, isError} = useAnosLectivos()
  const iniciar = useIniciarAnoLectivo()

  const list = data?.data ?? []

  const statusBadge = (estado: string) => ({
    className: STATUS_CLASS[estado] ?? 'badge badge-light-secondary',
    label: intl.formatMessage({id: `academico.anos.estado.${estado}`, defaultMessage: estado}),
  })

  const onIniciar = (ano: AnoLectivo) => {
    iniciar.mutate(ano.id, {
      onSuccess: () => toast.success(t('academico.anos.toast.iniciado', {name: ano.nombre})),
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : t('common.toast.genericError')
        toast.error(message)
      },
    })
  }

  const openEdit = (ano: AnoLectivo) => {
    setFormAno(ano)
    setShowCreate(true)
  }
  const openCreate = () => {
    setFormAno(null)
    setShowCreate(true)
  }
  const closeForm = () => {
    setShowCreate(false)
    setFormAno(null)
  }

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{t('academico.anos.title')}</PageTitle>
      <Content>
        <div className='card'>
          <div className='card-header border-0 pt-6'>
            <div className='card-title flex-column align-items-start'>
              <h3 className='fw-bold mb-1'>{t('academico.anos.title')}</h3>
              <span className='text-muted fs-7'>{t('academico.anos.subtitle')}</span>
            </div>
            <div className='card-toolbar'>
              <button type='button' className='btn btn-primary' onClick={openCreate}>
                <i className='ki-duotone ki-plus fs-2'></i>
                {t('academico.anos.new')}
              </button>
            </div>
          </div>

          <div className='card-body py-4'>
            {isLoading && (
              <div className='d-flex justify-content-center align-items-center py-15'>
                <span className='spinner-border text-primary me-3' role='status'></span>
                <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.anoLectivo'})})}</span>
              </div>
            )}

            {isError && !isLoading && (
              <div className='alert alert-danger d-flex align-items-center my-5'>
                <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.anoLectivo'})})}</span>
              </div>
            )}

            {!isLoading && !isError && (
              <div className='table-responsive'>
                <table className='table table-row-dashed align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                      <th className='min-w-150px'>{t('common.name')}</th>
                      <th className='min-w-150px'>{t('academico.anos.col.calendario')}</th>
                      <th className='min-w-200px'>{t('academico.anos.col.fechas')}</th>
                      <th className='min-w-100px'>{t('academico.anos.col.periodos')}</th>
                      <th className='min-w-125px'>{t('common.status')}</th>
                      <th className='min-w-250px text-end'>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className='text-gray-600 fw-semibold'>
                    {list.map((a) => {
                      const status = statusBadge(a.estado)
                      const rowIniciando = iniciar.isPending && iniciar.variables === a.id
                      return (
                        <tr key={a.id}>
                          <td>
                            <span className='text-gray-800 fw-bold'>{a.nombre}</span>
                          </td>
                          <td>
                            <span className='text-gray-700'>
                              {t(`academico.anos.calendario.${a.tipo_calendario}`)}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-700'>
                              {toDate(a.fecha_inicio)} &rarr; {toDate(a.fecha_fin)}
                            </span>
                          </td>
                          <td>
                            <span className='text-gray-700'>
                              {t('academico.anos.periodosCount', {count: a.num_periodos})}
                            </span>
                            {a.tiene_quinto_periodo && (
                              <span className='badge badge-light-info ms-2'>
                                {t('academico.anos.quinto')}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={status.className}>{status.label}</span>
                          </td>
                          <td>
                            <div className='d-flex align-items-center justify-content-end flex-shrink-0 gap-2'>
                              <button
                                type='button'
                                className='btn btn-light btn-sm'
                                onClick={() => setPeriodosAno(a)}
                              >
                                <i className='ki-duotone ki-calendar-8 fs-6 me-1'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                  <span className='path4'></span>
                                  <span className='path5'></span>
                                  <span className='path6'></span>
                                </i>
                                {t('academico.anos.periodosBtn')}
                              </button>
                              <button
                                type='button'
                                className='btn btn-icon btn-light-primary btn-sm'
                                title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.anoLectivo'})})}
                                onClick={() => openEdit(a)}
                              >
                                <i className='ki-duotone ki-pencil fs-5'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {a.estado === 'planificado' && (
                                <button
                                  type='button'
                                  className='btn btn-light-success btn-sm'
                                  disabled={rowIniciando}
                                  onClick={() => onIniciar(a)}
                                >
                                  {rowIniciando ? (
                                    <span className='spinner-border spinner-border-sm align-middle'></span>
                                  ) : (
                                    t('academico.anos.iniciar')
                                  )}
                                </button>
                              )}
                              {a.estado === 'en_curso' && (
                                <button
                                  type='button'
                                  className='btn btn-light-danger btn-sm'
                                  onClick={() => setCerrando(a)}
                                >
                                  {t('common.close')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {list.length === 0 && (
                      <tr>
                        <td colSpan={6} className='text-center text-muted py-10'>
                          {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.anoLectivo'})})}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Content>

      <AnoLectivoFormDialog show={showCreate} ano={formAno} onClose={closeForm} />
      <CerrarAnoLectivoDialog
        show={cerrando !== null}
        ano={cerrando}
        onClose={() => setCerrando(null)}
      />
      <PeriodosDialog
        show={periodosAno !== null}
        ano={periodosAno}
        onClose={() => setPeriodosAno(null)}
      />
    </>
  )
}

export default AnosLectivosPage
