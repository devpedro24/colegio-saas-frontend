import {useMemo, useState} from 'react'
import {toAbsoluteUrl} from '../../../helpers'

export type Team = {
  avatar: string
  name: string
}

type Props = {
  teams: Team[]
  defaultIndex?: number
}

// Sin buscar mostramos solo los MAX_RECENT más recientes. Al buscar, filtra por nombre en toda
// la lista; se ven máximo ~MAX_VISIBLE a la vez y el resto queda tras un scroll interno. En el
// futuro (miles de colegios) esto lo resolverá el backend: recientes + búsqueda server-side.
const MAX_RECENT = 5
const MAX_VISIBLE = 9

// Selector estilo "Thunder" (colegio-saas sidebar-header) adaptado a clases Metronic:
// trigger = avatar + nombre + chevron; al abrir, lista de opciones seleccionables (check en la
// activa) con scroll interno y buscador al final. Expansión inline (no overlay) para no ser
// recortado por el scroll del drawer. Solo se usa en la sección MÓVIL del sidebar.
const MobileTeamSelector = ({teams, defaultIndex = 0}: Props) => {
  const [selected, setSelected] = useState(defaultIndex)
  const [order, setOrder] = useState<number[]>(() => teams.map((_, i) => i))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = teams[selected] || teams[0]

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return order.slice(0, MAX_RECENT).map((i) => teams[i])
    return teams.filter((t) => t.name.toLowerCase().includes(q))
  }, [teams, order, query])

  // Los recientes son MRU: al elegir uno que NO está entre los 5, pasa al frente (más reciente).
  const pick = (idx: number) => {
    setSelected(idx)
    setOrder((prev) =>
      prev.slice(0, MAX_RECENT).includes(idx) ? prev : [idx, ...prev.filter((i) => i !== idx)]
    )
    setOpen(false)
    setQuery('')
  }

  // Altura máx = ~MAX_VISIBLE ítems (cada uno ~38px); si hay más, scroll interno.
  const maxHeight = MAX_VISIBLE * 38

  return (
    <div className='mb-2'>
      {/* begin::Trigger */}
      <button
        type='button'
        className='btn btn-light d-flex align-items-center w-100 px-3 py-2'
        onClick={() => setOpen((v) => !v)}
      >
        <div className='symbol symbol-35px me-3'>
          <img src={toAbsoluteUrl(`media/avatars/${current.avatar}`)} alt={current.name} />
        </div>
        <span className='fw-bold text-gray-800 flex-grow-1 text-start'>{current.name}</span>
        <i className={`ki-solid ki-down fs-3 text-gray-500${open ? ' rotate-180' : ''}`}></i>
      </button>
      {/* end::Trigger */}

      {/* begin::List */}
      {open && (
        <div className='menu menu-column menu-rounded menu-gray-800 menu-state-bg menu-state-color fw-semibold fs-6 w-100 mt-2 border border-gray-200 rounded py-2'>
          {/* begin::Scroll (máx ~9 visibles) */}
          <div className='scroll-y' style={{maxHeight, overflowY: 'auto'}}>
            {list.map((t) => {
              const idx = teams.indexOf(t)
              return (
                <div className='menu-item px-3' key={idx}>
                  <a
                    href='#'
                    className={`menu-link px-3 d-flex align-items-center${
                      idx === selected ? ' active' : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      pick(idx)
                    }}
                  >
                    <div className='symbol symbol-25px me-3'>
                      <img src={toAbsoluteUrl(`media/avatars/${t.avatar}`)} alt={t.name} />
                    </div>
                    <span className='flex-grow-1'>{t.name}</span>
                    {idx === selected && <i className='ki-solid ki-check fs-2 text-primary'></i>}
                  </a>
                </div>
              )
            })}

            {list.length === 0 && (
              <div className='text-muted px-4 py-2 fs-7'>Sin resultados</div>
            )}
          </div>
          {/* end::Scroll */}

          {/* begin::Buscador (al final) */}
          <div className='separator my-2'></div>
          <div className='px-3 py-1'>
            <div className='position-relative'>
              <i className='ki-outline ki-magnifier fs-5 text-gray-500 position-absolute top-50 translate-middle-y ms-3'></i>
              <input
                type='text'
                className='form-control form-control-sm form-control-solid ps-10'
                placeholder='Buscar colegio...'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          {/* end::Buscador */}
        </div>
      )}
      {/* end::List */}
    </div>
  )
}

export {MobileTeamSelector}
