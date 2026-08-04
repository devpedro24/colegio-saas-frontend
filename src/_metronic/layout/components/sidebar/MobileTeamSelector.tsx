import {useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {toAbsoluteUrl} from '../../../helpers'

// Ítem del selector de caritas. Puede pintarse con avatar (demo) o con inicial (colegios reales).
// `isPlatform` marca la carita FIJA "Plataforma" (siempre primera, no entra en la rotación MRU).
export type RailItem = {
  id: string
  name: string
  avatar?: string
  initial?: string
  isPlatform?: boolean
}

// Alias retro-compatible con el nombre anterior del tipo.
export type Team = RailItem

type Props = {
  items: RailItem[]
  /** id del ítem activo (controlado por el padre). */
  activeId: string
  /** Selección de un ítem (el padre decide qué hacer: entrar/salir de suplantación, etc.). */
  onSelect: (item: RailItem) => void
  /** Placeholder del buscador. Default: "Buscar colegio...". */
  searchPlaceholder?: string
}

// Sin buscar mostramos solo los MAX_RECENT más recientes. Al buscar, filtra por nombre en toda
// la lista; se ven máximo ~MAX_VISIBLE a la vez y el resto queda tras un scroll interno.
const MAX_RECENT = 5
const MAX_VISIBLE = 9

/** Carita: avatar si lo hay; si no, inicial en un círculo (color distinto para "Plataforma"). */
function Face({item, size}: {item: RailItem; size: number}) {
  if (item.avatar) {
    return (
      <div className={`symbol symbol-${size}px symbol-circle`}>
        <img src={toAbsoluteUrl(`media/avatars/${item.avatar}`)} alt={item.name} />
      </div>
    )
  }
  const cls = item.isPlatform ? 'bg-primary text-inverse-primary' : 'bg-light-primary text-primary'
  return (
    <div className={`symbol symbol-${size}px symbol-circle`}>
      <span className={`symbol-label fw-bold ${cls}`}>
        {item.initial ?? item.name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

// Selector estilo "Thunder" adaptado a clases Metronic: trigger = carita + nombre + chevron; al
// abrir, lista de opciones seleccionables (check en la activa) con scroll interno y buscador al
// final. La carita "Plataforma" (isPlatform) queda SIEMPRE primera. Sólo se usa en el MÓVIL.
const MobileTeamSelector = ({items, activeId, onSelect, searchPlaceholder}: Props) => {
  const intl = useIntl()
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  // Mantén el orden MRU sincronizado con los items (añade nuevos al final, quita los que ya no están).
  useEffect(() => {
    setOrder((prev) => {
      const ids = items.map((i) => i.id)
      const kept = prev.filter((id) => ids.includes(id))
      const added = ids.filter((id) => !kept.includes(id))
      return [...kept, ...added]
    })
  }, [items])

  // La carita "Plataforma" va siempre primero; el resto conserva el orden MRU.
  const pinned = (ids: string[]) => {
    const platform = ids.filter((id) => byId.get(id)?.isPlatform)
    const rest = ids.filter((id) => !byId.get(id)?.isPlatform)
    return [...platform, ...rest]
  }

  const current = byId.get(activeId) ?? items[0]

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return pinned(order)
        .slice(0, MAX_RECENT)
        .map((id) => byId.get(id))
        .filter((i): i is RailItem => !!i)
    }
    return items.filter((i) => i.name.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, order, query, byId])

  // MRU: al elegir un colegio que NO está entre los recientes, pasa al frente. "Plataforma" no rota.
  const pick = (item: RailItem) => {
    if (!item.isPlatform) {
      setOrder((prev) =>
        prev.slice(0, MAX_RECENT).includes(item.id)
          ? prev
          : [item.id, ...prev.filter((id) => id !== item.id)],
      )
    }
    onSelect(item)
    setOpen(false)
    setQuery('')
  }

  if (!current) return null

  const maxHeight = MAX_VISIBLE * 38

  return (
    <div className='mb-2'>
      {/* begin::Trigger */}
      <button
        type='button'
        className='btn btn-light d-flex align-items-center w-100 px-3 py-2'
        onClick={() => setOpen((v) => !v)}
      >
        <div className='me-3'>
          <Face item={current} size={35} />
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
            {list.map((t) => (
              <div className='menu-item px-3' key={t.id}>
                <a
                  href='#'
                  className={`menu-link px-3 d-flex align-items-center${
                    t.id === activeId ? ' active' : ''
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    pick(t)
                  }}
                >
                  <div className='me-3'>
                    <Face item={t} size={25} />
                  </div>
                  <span className='flex-grow-1'>{t.name}</span>
                  {t.id === activeId && <i className='ki-solid ki-check fs-2 text-primary'></i>}
                </a>
              </div>
            ))}

            {list.length === 0 && (
              <div className='text-muted px-4 py-2 fs-7'>
                {intl.formatMessage({id: 'impersonation.noResults', defaultMessage: 'Sin resultados'})}
              </div>
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
                placeholder={
                  searchPlaceholder ??
                  intl.formatMessage({
                    id: 'impersonation.searchPlaceholder',
                    defaultMessage: 'Buscar colegio...',
                  })
                }
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
