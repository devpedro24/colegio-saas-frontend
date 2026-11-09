import {useSedeMessages} from '../../../academico/configuracion/components/useSedeMessages'
import {useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useColegioSedes, useDeleteColegioSede} from '../colegios.api'
import type {Colegio} from '../colegios.types'
import type {Sede} from '../../../academico/estructura/estructura.types'
import {SedeFormDialog} from '../../../academico/configuracion/components/SedeFormDialog'
import {sedeSubdomainUrl} from '../../../academico/estructura/estructura.api'
import {DeleteConfirmDialog} from '../../../academico/estructura/components/DeleteConfirmDialog'
import {fromOpaqueAcademic} from '../../../academico/shared/opaqueAcademic'
import {useToast} from '@/lib/ui/toast'

type Props = {show: boolean; colegio: Colegio | null; onClose: () => void}

const SedesColegioDialog = ({show, colegio, onClose}: Props) => {
  const intl = useIntl()
  const t = useSedeMessages()
  const toast = useToast()
  const query = useColegioSedes(show ? (colegio?.slug ?? null) : null)
  const remove = useDeleteColegioSede()
  const [editing, setEditing] = useState<Sede | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Sede | null>(null)
  const rows = fromOpaqueAcademic<Sede[]>(query.data?.data ?? [])
  if (!show || !colegio) return null
  if (editing !== undefined)
    return (
      <SedeFormDialog
        schoolSlug={colegio.slug}
        sede={editing}
        onClose={saved => {
          setEditing(undefined)
          if (saved?.principal && saved.slug !== colegio.slug) onClose()
          else query.refetch()
        }}
      />
    )
  return (
    <>
      <Modal show={!deleting} onHide={onClose} centered scrollable size='lg'>
        <Modal.Header closeButton>
          <Modal.Title>
            {t('academico.estructura.tab.sedes')} · {colegio.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className='p-6'>
          <div className='d-flex justify-content-end mb-5'>
            <button className='btn btn-primary' onClick={() => setEditing(null)}>
              {t('sede.create')}
            </button>
          </div>
          {query.isPending && <div role='status'>{t('sede.loading')}</div>}
          {query.isError && <div className='alert alert-danger'>{t('sede.loadError')}</div>}
          <div className='table-responsive'>
            <table className='table table-row-dashed align-middle'>
              <thead>
                <tr>
                  <th>{t('colegios.sedes.field.name')}</th>
                  <th>{t('common.subdomain')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((sede) => (
                  <tr key={sede.id}>
                    <td>
                      {sede.nombre}
                      <div className='text-muted fs-7'>{sede.coordinador_name}</div>
                    </td>
                    <td>
                      {sede.tenant_domain
                        ? new URL(sedeSubdomainUrl(sede.tenant_domain)).host
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${sede.estado === 'activa' ? 'badge-light-success' : 'badge-light-warning'}`}
                      >
                        {t(
                          sede.estado === 'activa'
                            ? 'common.active'
                            : sede.estado === 'mantenimiento'
                              ? 'sede.maintenance'
                              : 'common.inactive'
                        )}
                      </span>
                    </td>
                    <td>
                      <div className='d-flex gap-2'>
                        <button
                          className='btn btn-sm btn-light-primary'
                          onClick={() => setEditing(sede)}
                        >
                          {t('sede.edit')}
                        </button>
                        {!sede.principal && (
                          <button
                            className='btn btn-sm btn-light-danger'
                            onClick={() => setDeleting(sede)}
                            aria-label={intl.formatMessage(
                              {id: 'common.delete'},
                              {name: sede.nombre}
                            )}
                          >
                            <i className='bi bi-trash' />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button className='btn btn-light' onClick={onClose}>
            {t('common.close')}
          </button>
        </Modal.Footer>
      </Modal>
      <DeleteConfirmDialog
        show={!!deleting}
        title={t('academico.estructura.deleteConfirm.title')}
        text={t('academico.estructura.deleteConfirm.text')}
        pending={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(
            {slug: colegio.slug, sedeToken: deleting.id},
            {
              onSuccess: () => {
                setDeleting(null)
                toast.success(t('common.toast.deleted'), 'deleted')
              },
              onError: (error) => toast.error(error.message)
            }
          )
        }}
      />
    </>
  )
}
export {SedesColegioDialog}
