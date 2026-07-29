import {FC, useEffect, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {PLAN_FEATURES} from '../planes.mock'
import {Plan, PlanPeriod} from '../planes.types'

// Los modales se montan en #root-modals (fallback a body). Portal => quedan fuera del
// arbol del card y sobre el backdrop.
const modalsRoot = document.getElementById('root-modals') || document.body

type Props = {
  show: boolean
  /** null => Crear; un plan => Editar (precargado). */
  plan: Plan | null
  onClose: () => void
}

// Modal "Nuevo plan" / "Editar plan". Solo UI: el submit unicamente cierra el modal.
// Campos: Nombre, Descripcion (textarea), Precio, Periodicidad, Features (toggles).
const PlanFormDialog: FC<Props> = ({show, plan, onClose}) => {
  const isEdit = plan !== null

  // Estado controlado para features y periodicidad; se reinicia al abrir el modal.
  const [selected, setSelected] = useState<string[]>([])
  const [period, setPeriod] = useState<PlanPeriod>('mensual')

  useEffect(() => {
    if (show) {
      setSelected(plan?.features ?? [])
      setPeriod(plan?.period ?? 'mensual')
    }
  }, [show, plan])

  const toggleFeature = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onClose()
  }

  return createPortal(
    <Modal
      id='kt_modal_plan_form'
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-650px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <div className='d-flex flex-column'>
          <h2 className='fw-bold'>{isEdit ? 'Editar plan' : 'Nuevo plan'}</h2>
          <span className='text-muted fs-7'>
            Define el precio y activa las features incluidas en el plan
          </span>
        </div>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>

      {/* key => remonta el form con los defaultValue del plan seleccionado */}
      <form onSubmit={handleSubmit} key={plan?.id ?? 'new'}>
        <div className='modal-body py-lg-10 px-lg-10'>
          {/* Nombre */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>Nombre del plan</label>
            <input
              type='text'
              className='form-control form-control-solid'
              placeholder='Ej. Esencial'
              defaultValue={plan?.name ?? ''}
            />
          </div>

          {/* Descripcion */}
          <div className='fv-row mb-7'>
            <label className='fs-6 fw-semibold mb-2'>Descripcion</label>
            <textarea
              className='form-control form-control-solid'
              rows={2}
              placeholder='Para quien es este plan...'
              defaultValue={plan?.description ?? ''}
            />
          </div>

          {/* Precio + Periodicidad */}
          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>Precio (COP)</label>
              <div className='input-group'>
                <span className='input-group-text'>$</span>
                <input
                  type='number'
                  min='0'
                  step='1000'
                  className='form-control form-control-solid'
                  placeholder='149000'
                  defaultValue={plan?.price ?? ''}
                />
              </div>
            </div>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>Periodicidad</label>
              <select
                className='form-select form-select-solid'
                value={period}
                onChange={(e) => setPeriod(e.target.value as PlanPeriod)}
              >
                <option value='mensual'>Mensual</option>
                <option value='anual'>Anual</option>
              </select>
            </div>
          </div>

          {/* Features editables */}
          <div className='fv-row'>
            <label className='fs-6 fw-semibold mb-2'>Features incluidas</label>
            <div className='text-muted fs-7 mb-4'>
              Activa las features que trae este plan ({selected.length} seleccionadas).
            </div>
            <div className='mh-300px overflow-auto pe-2'>
              {PLAN_FEATURES.map((f) => (
                <label
                  key={f.key}
                  className='d-flex align-items-center justify-content-between border border-gray-300 border-dashed rounded p-4 mb-3 cursor-pointer'
                >
                  <span className='fw-semibold text-gray-800 fs-6'>{f.label}</span>
                  <span className='form-check form-switch form-check-custom form-check-solid ms-3'>
                    <input
                      className='form-check-input'
                      type='checkbox'
                      checked={selected.includes(f.key)}
                      onChange={() => toggleFeature(f.key)}
                    />
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            Cancelar
          </button>
          <button type='submit' className='btn btn-primary'>
            {isEdit ? 'Guardar cambios' : 'Guardar plan'}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

export {PlanFormDialog}
