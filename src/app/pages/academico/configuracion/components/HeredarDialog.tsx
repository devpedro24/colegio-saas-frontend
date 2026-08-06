import {FC, useState} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'

const modalsRoot = document.getElementById('root-modals') || document.body

export const CATEGORIAS_HEREDABLES = [
  {key: 'anos', i18n: 'academico.estructura.sede.heredar.anos'},
  {key: 'escalas', i18n: 'academico.estructura.sede.heredar.escalas'},
  {key: 'metodos', i18n: 'academico.estructura.sede.heredar.metodos'},
  {key: 'modelos', i18n: 'academico.estructura.sede.heredar.modelos'},
  {key: 'datos', i18n: 'academico.estructura.sede.heredar.datos'},
  {key: 'niveles', i18n: 'academico.estructura.sede.heredar.niveles'},
] as const

type Props = {
  show: boolean
  sedeNombre: string
  pending: boolean
  onConfirm: (categorias: string[]) => void
  onClose: () => void
}

const HeredarDialog: FC<Props> = ({show, sedeNombre, pending, onConfirm, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  const [selected, setSelected] = useState<string[]>(CATEGORIAS_HEREDABLES.map((c) => c.key))

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const allSelected = selected.length === CATEGORIAS_HEREDABLES.length
  const toggleAll = () => {
    setSelected(allSelected ? [] : CATEGORIAS_HEREDABLES.map((c) => c.key))
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
        <h2 className='fw-bold'>{t('academico.estructura.sede.heredar')}</h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <div className='modal-body py-lg-10 px-lg-10'>
        <p className='text-gray-700 fs-6 mb-6'>
          {intl.formatMessage(
            {id: 'academico.estructura.sede.heredarText', defaultMessage: 'Selecciona qué categorías copiar a {sede}:'},
            {sede: <span className='fw-bold text-gray-900'>{sedeNombre}</span>},
          )}
        </p>

        <div className='mb-4'>
          <label className='form-check form-check-custom form-check-solid mb-2'>
            <input
              className='form-check-input'
              type='checkbox'
              checked={allSelected}
              onChange={toggleAll}
            />
            <span className='form-check-label fw-bold text-gray-800'>
              {t('academico.estructura.sede.heredar.todos')}
            </span>
          </label>
          <div className='separator separator-dashed my-3'></div>
          {CATEGORIAS_HEREDABLES.map((cat) => (
            <label key={cat.key} className='form-check form-check-custom form-check-solid mb-2 ms-4'>
              <input
                className='form-check-input'
                type='checkbox'
                checked={selected.includes(cat.key)}
                onChange={() => toggle(cat.key)}
              />
              <span className='form-check-label text-gray-700'>{t(cat.i18n)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button
          type='button'
          className='btn btn-info'
          disabled={pending || selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          {pending ? (
            <span className='spinner-border spinner-border-sm align-middle'></span>
          ) : (
            t('academico.estructura.sede.heredar')
          )}
        </button>
      </div>
    </Modal>,
    modalsRoot,
  )
}

export {HeredarDialog}
