import {FC} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {PLAN_OPTIONS} from '../colegios.mock'
import {Colegio} from '../colegios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  colegio: Colegio | null
  onClose: () => void
}

// Modal "Editar colegio". Mismos campos que Crear pero precargados con el colegio.
// Solo UI: el submit unicamente cierra el modal (sin backend).
const EditColegioDialog: FC<Props> = ({show, colegio, onClose}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onClose()
  }

  return createPortal(
    <Modal
      id='kt_modal_edit_colegio'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <div className='d-flex flex-column'>
          <h2 className='fw-bold'>Editar colegio</h2>
          {colegio && (
            <span className='text-muted fs-7'>
              {colegio.subdomain}.midominio.com
            </span>
          )}
        </div>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {/* key => remonta el form con los defaultValue del colegio seleccionado */}
      <form onSubmit={handleSubmit} key={colegio?.id ?? 'none'}>
        <div className='modal-body py-lg-10 px-lg-10'>
          {/* Nombre */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Nombre del colegio</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='Ej. Colegio San Jose'
              defaultValue={colegio?.name ?? ''}
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
                defaultValue={colegio?.subdomain ?? ''}
              />
              <span className='input-group-text'>.midominio.com</span>
            </div>
          </div>

          {/* Plan */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Plan</label>
            <select
              className='form-select form-select-solid'
              defaultValue={colegio?.plan ?? ''}
            >
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
                defaultValue={colegio?.rector.name ?? ''}
              />
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>Correo del rector</label>
              <input
                type='email'
                className='form-control form-control-solid'
                placeholder='rector@colegio.edu.co'
                defaultValue={colegio?.rector.email ?? ''}
              />
            </div>
          </div>
        </div>

        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            Cancelar
          </button>
          <button type='submit' className='btn btn-primary'>
            Guardar cambios
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

export {EditColegioDialog}
