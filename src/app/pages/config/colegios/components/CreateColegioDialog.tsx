import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {PLAN_OPTIONS} from '../colegios.mock'

// Los modales se montan en #root-modals (fallback a body). Portal => quedan fuera del
// arbol del card y sobre el backdrop.
const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  onClose: () => void
}

// Modal "Nuevo colegio". Solo UI: el submit unicamente cierra el modal (sin backend).
// Campos: Nombre, Subdominio (input-group con sufijo .midominio.com), Plan, Rector (nombre+correo).
const CreateColegioDialog: FC<Props> = ({show, onClose}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onClose()
  }

  return createPortal(
    <Modal
      id='kt_modal_create_colegio'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>Nuevo colegio</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className='modal-body py-lg-10 px-lg-10'>
          {/* Nombre */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Nombre del colegio</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='Ej. Colegio San Jose'
            />
          </div>

          {/* Subdominio */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Subdominio</label>
            <div className='input-group'>
              <input
                type='text'
                className='form-control form-control-solid'
                placeholder='sanjose'
              />
              <span className='input-group-text'>.midominio.com</span>
            </div>
          </div>

          {/* Plan */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Plan</label>
            <select className='form-select form-select-solid' defaultValue=''>
              <option value='' disabled>
                Selecciona un plan
              </option>
              {PLAN_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rector */}
          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>Nombre del rector</label>
              <input
                type='text'
                className='form-control form-control-solid'
                placeholder='Nombre completo'
              />
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>Correo del rector</label>
              <input
                type='email'
                className='form-control form-control-solid'
                placeholder='rector@colegio.edu.co'
              />
            </div>
          </div>
        </div>

        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            Cancelar
          </button>
          <button type='submit' className='btn btn-primary'>
            Guardar colegio
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

export {CreateColegioDialog}
