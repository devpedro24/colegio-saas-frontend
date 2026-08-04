import {FC, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {useToast} from '@/lib/ui/toast'
import {useColegios, useUpdateColegioStatus} from './colegios.api'
import {Colegio} from './colegios.types'
import {CreateColegioDialog} from './components/CreateColegioDialog'
import {EditColegioDialog} from './components/EditColegioDialog'
import {RectorPasswordDialog} from './components/RectorPasswordDialog'
import {DisableColegioDialog} from './components/DisableColegioDialog'
import {SedesColegioDialog} from './components/SedesColegioDialog'

// Estado del colegio -> clase de badge (la etiqueta se resuelve por i18n).
const STATUS_CLASS: Record<string, string> = {
  active: 'badge badge-light-success',
  configuring: 'badge badge-light-warning',
  provisioning: 'badge badge-light-secondary',
  suspended: 'badge badge-light-danger',
}

// Plan -> clase de badge (la etiqueta se resuelve por i18n).
const PLAN_CLASS: Record<string, string> = {
  esencial: 'badge badge-light-primary',
  estandar: 'badge badge-light-info',
  premium: 'badge badge-light-dark',
}

const ColegiosPage: FC = () => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({id}, values)

  const configBreadCrumbs: Array<PageLink> = [
    {
      title: t('config.breadcrumb'),
      path: '/configuracion/colegios',
      isSeparator: false,
      isActive: false,
    },
  ]

  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Colegio | null>(null)
  const [pwdColegio, setPwdColegio] = useState<Colegio | null>(null)
  const [sedesColegio, setSedesColegio] = useState<Colegio | null>(null)
  const [disabling, setDisabling] = useState<Colegio | null>(null)

  const toast = useToast()
  const {data, isLoading, isError} = useColegios()
  const updateStatus = useUpdateColegioStatus()

  const statusBadge = (status: string) => ({
    className: STATUS_CLASS[status] ?? 'badge badge-light-secondary',
    label: intl.formatMessage({id: `colegios.status.${status}`, defaultMessage: status}),
  })
  const planBadge = (plan: string) => ({
    className: PLAN_CLASS[plan] ?? 'badge badge-light-secondary',
    label: intl.formatMessage({id: `plan.${plan}`, defaultMessage: plan}),
  })

  // Busqueda local por nombre.
  const filtered = useMemo(() => {
    const list = data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => c.name.toLowerCase().includes(q))
  }, [data, search])

  // Switch Habilitar/Inhabilitar. Habilitar es directo; inhabilitar pide confirmacion.
  const onToggle = (colegio: Colegio, nextEnabled: boolean) => {
    if (nextEnabled) {
      updateStatus.mutate(
        {id: colegio.id, status: 'active'},
        {
          onSuccess: () => toast.success(t('colegios.toast.enabled', {name: colegio.name})),
          onError: () => toast.error(t('colegios.toast.enableError')),
        }
      )
    } else {
      setDisabling(colegio)
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={configBreadCrumbs}>{t('colegios.title')}</PageTitle>
      <Content>
        {/* begin::Card */}
        <div className='card'>
          {/* begin::Card header */}
          <div className='card-header border-0 pt-6'>
            {/* begin::Card title */}
            <div className='card-title flex-column align-items-start'>
              <h3 className='fw-bold mb-1'>{t('colegios.title')}</h3>
              <span className='text-muted fs-7'>{t('colegios.subtitle')}</span>
            </div>
            {/* end::Card title */}

            {/* begin::Card toolbar */}
            <div className='card-toolbar flex-wrap gap-3'>
              {/* begin::Search */}
              <div className='d-flex align-items-center position-relative'>
                <i className='ki-duotone ki-magnifier fs-3 position-absolute ms-4'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
                <input
                  type='text'
                  className='form-control form-control-solid w-250px ps-12'
                  placeholder={t('colegios.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* end::Search */}

              {/* begin::New */}
              <button type='button' className='btn btn-primary' onClick={() => setShowCreate(true)}>
                <i className='ki-duotone ki-plus fs-2'></i>
                {t('colegios.new')}
              </button>
              {/* end::New */}
            </div>
            {/* end::Card toolbar */}
          </div>
          {/* end::Card header */}

          {/* begin::Card body */}
          <div className='card-body py-4'>
            {/* Loading */}
            {isLoading && (
              <div className='d-flex justify-content-center align-items-center py-15'>
                <span className='spinner-border text-primary me-3' role='status'></span>
                <span className='text-muted fs-6'>{t('colegios.loading')}</span>
              </div>
            )}

            {/* Error */}
            {isError && !isLoading && (
              <div className='alert alert-danger d-flex align-items-center my-5'>
                <i className='ki-duotone ki-information fs-2 text-danger me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <span>{t('colegios.loadError')}</span>
              </div>
            )}

            {/* begin::Table responsive */}
            {!isLoading && !isError && (
              <div className='table-responsive'>
                <table className='table table-row-dashed align-middle gs-0 gy-4'>
                  {/* begin::Head */}
                  <thead>
                    <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                      <th className='min-w-250px'>{t('colegios.col.name')}</th>
                      <th className='min-w-175px'>{t('colegios.col.subdomain')}</th>
                      <th className='min-w-100px'>{t('colegios.col.plan')}</th>
                      <th className='min-w-125px'>{t('colegios.col.status')}</th>
                      <th className='min-w-200px text-end'>{t('colegios.col.actions')}</th>
                    </tr>
                  </thead>
                  {/* end::Head */}
                  {/* begin::Body */}
                  <tbody className='text-gray-600 fw-semibold'>
                    {filtered.map((c) => {
                      const enabled = c.status !== 'suspended'
                      const rowPending =
                        updateStatus.isPending && updateStatus.variables?.id === c.id
                      const status = statusBadge(c.status)
                      const plan = planBadge(c.plan)
                      return (
                        <tr key={c.id}>
                          {/* Nombre + razon social */}
                          <td>
                            <div className='d-flex flex-column'>
                              <span className='text-gray-800 fw-bold'>{c.name}</span>
                              {c.legal_name && (
                                <span className='text-muted fs-7'>{c.legal_name}</span>
                              )}
                            </div>
                          </td>
                          {/* Subdominio */}
                          <td>
                            <span className='text-gray-700'>{c.subdomain}</span>
                          </td>
                          {/* Plan */}
                          <td>
                            <span className={plan.className}>{plan.label}</span>
                          </td>
                          {/* Estado */}
                          <td>
                            <span className={status.className}>{status.label}</span>
                          </td>
                          {/* Acciones */}
                          <td>
                            <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                              {/* Editar */}
                              <button
                                type='button'
                                className='btn btn-icon btn-light-primary btn-sm me-2'
                                title={t('colegios.edit')}
                                onClick={() => setEditing(c)}
                              >
                                <i className='ki-duotone ki-pencil fs-5'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {/* Contrasena rector */}
                              <button
                                type='button'
                                className='btn btn-icon btn-light btn-sm me-2'
                                title={t('colegios.rectorPassword')}
                                onClick={() => setPwdColegio(c)}
                              >
                                <i className='ki-duotone ki-key fs-5'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {/* Sedes del colegio */}
                              <button
                                type='button'
                                className='btn btn-icon btn-light btn-sm me-4'
                                title={t('colegios.sedes.title')}
                                onClick={() => setSedesColegio(c)}
                              >
                                <i className='ki-duotone ki-home-1 fs-5'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </button>
                              {/* Habilitar / Inhabilitar */}
                              <div className='form-check form-switch form-check-solid'>
                                <input
                                  className='form-check-input'
                                  type='checkbox'
                                  checked={enabled}
                                  disabled={rowPending}
                                  onChange={() => onToggle(c, !enabled)}
                                  title={enabled ? t('colegios.disable') : t('colegios.enable')}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className='text-center text-muted py-10'>
                          {t('colegios.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {/* end::Body */}
                </table>
              </div>
            )}
            {/* end::Table responsive */}
          </div>
          {/* end::Card body */}
        </div>
        {/* end::Card */}
      </Content>

      {/* Modales conectados al backend real */}
      <CreateColegioDialog show={showCreate} onClose={() => setShowCreate(false)} />
      <EditColegioDialog
        show={editing !== null}
        colegio={editing}
        onClose={() => setEditing(null)}
      />
      <RectorPasswordDialog
        show={pwdColegio !== null}
        colegio={pwdColegio}
        onClose={() => setPwdColegio(null)}
      />
      <SedesColegioDialog
        show={sedesColegio !== null}
        colegio={sedesColegio}
        onClose={() => setSedesColegio(null)}
      />
      <DisableColegioDialog
        show={disabling !== null}
        colegio={disabling}
        onClose={() => setDisabling(null)}
      />
    </>
  )
}

export default ColegiosPage
