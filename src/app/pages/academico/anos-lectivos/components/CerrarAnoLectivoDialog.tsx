import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {FormattedMessage, useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCerrarAnoLectivo, useRevisionCierreAno} from '../anos-lectivos.api'
import type {AnoLectivo} from '../anos-lectivos.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  ano: AnoLectivo | null
  onClose: () => void
}

// El cierre no calcula promoción: requiere decisiones previamente aprobadas y vigentes.
const CerrarAnoLectivoDialog: FC<Props> = ({show, ano, onClose}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const cerrar = useCerrarAnoLectivo()
  const revision = useRevisionCierreAno(ano?.id ?? null, show)
  const diagnostico = revision.data?.data

  const confirm = () => {
    if (!ano || revision.isFetching || !diagnostico?.puede_cerrar) return
    cerrar.mutate({id: ano.id, sinMatriculas: diagnostico.sin_matriculas,
      soloRetiradas: diagnostico.solo_retiradas}, {
      onSuccess: () => {
        toast.success(intl.formatMessage({id: 'academico.anos.toast.cerrado'}, {name: ano.nombre}))
        onClose()
      },
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : t('common.toast.genericError')
        toast.error(message)
      },
    })
  }

  return createPortal(
    <Modal
      id='kt_modal_cerrar_ano'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-500px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>{t('academico.anos.cerrar.title')}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      <div className='modal-body py-lg-10 px-lg-10 text-center'>
        <i className='ki-duotone ki-lock-2 fs-5x text-warning mb-5'>
          <span className='path1'></span>
          <span className='path2'></span>
          <span className='path3'></span>
        </i>
        <div className='fs-5 text-gray-800 mb-4'>
          <FormattedMessage
            id='academico.anos.cerrar.body'
            values={{name: <span className='fw-bold'>{ano?.nombre}</span>}}
          />
        </div>
        {revision.isFetching && <div role='status'>{t('academico.anos.cierre.revisando')}</div>}
        {revision.isError && (
          <div className='alert alert-danger text-start' role='alert'>
            {t('academico.anos.cierre.error')}
            <button type='button' className='btn btn-sm btn-light ms-2' onClick={() => revision.refetch()}>
              {t('academico.anos.cierre.reintentar')}
            </button>
          </div>
        )}
        {diagnostico && (
          <div className='text-start'>
            <p className='mb-2'>{t('academico.anos.cierre.resumen', {
              cerrados: diagnostico.periodos_cerrados,
              esperados: diagnostico.periodos_esperados,
              matriculas: diagnostico.matriculas,
            })}</p>
            {diagnostico.bloqueos.length > 0 ? (
              <div className='alert alert-warning' role='alert'>
                <div className='fw-bold mb-2'>{t('academico.anos.cierre.pendientes')}</div>
                <ul className='mb-0'>
                  {diagnostico.bloqueos.map((code) => (
                    <li key={code}>{t(`academico.anos.cierre.bloqueos.${code}`)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className='alert alert-info' role='status'>{t(diagnostico.sin_matriculas
                ? 'academico.anos.cierre.sinMatriculas' : diagnostico.solo_retiradas
                  ? 'academico.anos.cierre.soloRetiradas' : 'academico.anos.cierre.conPromociones')}</div>
            )}
          </div>
        )}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          type='button'
          className='btn btn-danger'
          onClick={confirm}
          disabled={cerrar.isPending || revision.isFetching || revision.isError || !diagnostico?.puede_cerrar}
        >
          {cerrar.isPending ? (
            <span className='indicator-progress d-block'>
              {t('academico.anos.cerrar.pending')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            t('academico.anos.cerrar.confirm')
          )}
        </button>
      </div>
    </Modal>,
    modalsRoot
  )
}

export {CerrarAnoLectivoDialog}
