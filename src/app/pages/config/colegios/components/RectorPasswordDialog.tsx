import {FC, useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {Colegio} from '../colegios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  colegio: Colegio | null
  onClose: () => void
}

// Genera una contrasena temporal "aleatoria" solo para la demo (sin backend).
function mockPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// Modal "Contrasena del rector". Como la clave se guarda cifrada no se puede recuperar
// la anterior: se regenera una nueva y se muestra una sola vez. Solo UI.
const RectorPasswordDialog: FC<Props> = ({show, colegio, onClose}) => {
  const [generated, setGenerated] = useState<string | null>(null)

  // Al cerrar, limpia la contrasena mostrada para no dejarla en el DOM.
  useEffect(() => {
    if (!show) setGenerated(null)
  }, [show])

  const regenerate = () => setGenerated(mockPassword())

  return createPortal(
    <Modal
      id='kt_modal_rector_password'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-550px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {generated ? 'Nueva contrasena generada' : 'Contrasena del rector'}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      <div className='modal-body py-lg-10 px-lg-10'>
        {generated ? (
          <>
            <div className='text-muted fs-7 mb-5'>
              Guardala ahora: por seguridad solo se muestra una vez.
            </div>
            <div className='mb-3'>
              <span className='text-muted'>Colegio: </span>
              <span className='fw-bold text-gray-800'>{colegio?.name}</span>
            </div>
            <div className='mb-3'>
              <span className='text-muted'>Rector: </span>
              <span className='fw-bold text-gray-800'>{colegio?.rector.email}</span>
            </div>
            <div>
              <span className='text-muted'>Contrasena temporal:</span>
              <div className='mt-2 rounded bg-light-primary text-primary font-monospace fs-4 fw-bold px-4 py-3 text-center'>
                {generated}
              </div>
            </div>
          </>
        ) : (
          <div className='text-gray-700 fs-6'>
            Se generara una nueva contrasena temporal para el rector de{' '}
            <span className='fw-bold text-gray-900'>{colegio?.name}</span> (
            {colegio?.rector.email}). La contrasena anterior dejara de funcionar.
          </div>
        )}
      </div>

      <div className='modal-footer'>
        {generated ? (
          <button type='button' className='btn btn-primary' onClick={onClose}>
            Cerrar
          </button>
        ) : (
          <>
            <button type='button' className='btn btn-light' onClick={onClose}>
              Cancelar
            </button>
            <button type='button' className='btn btn-primary' onClick={regenerate}>
              <i className='ki-duotone ki-key fs-3'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              Regenerar contrasena
            </button>
          </>
        )}
      </div>
    </Modal>,
    modalsRoot
  )
}

export {RectorPasswordDialog}
