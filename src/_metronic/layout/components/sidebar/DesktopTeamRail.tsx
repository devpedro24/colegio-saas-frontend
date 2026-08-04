import {useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {useIntl} from 'react-intl'
import {toAbsoluteUrl} from '../../../helpers'
import {RailItem} from './MobileTeamSelector'

type Props = {
  items: RailItem[]
  /** id del ítem activo (controlado por el padre). */
  activeId: string
  /** Selección de un ítem (el padre decide qué hacer). */
  onSelect: (item: RailItem) => void
}

// Misma lógica que el selector móvil (recientes + buscador con scroll ~9) pero adaptada al rail
// de 70px: los MAX_RECENT recientes como caritas seleccionables (ring primario en la activa) y
// un botón de búsqueda que abre un POPOVER a la derecha del rail. El popover se renderiza con
// createPortal a document.body (position: fixed) para NO ser recortado por el overflow del
// sidebar (hover-scroll-overlay-y); se posiciona junto al botón con getBoundingClientRect.
//
// La carita "Plataforma" (isPlatform) queda SIEMPRE primera; los colegios rotan por MRU.
const MAX_RECENT = 5
const MAX_VISIBLE = 9
const POPOVER_WIDTH = 280
const POPOVER_MAX_HEIGHT = 440

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

const DesktopTeamRail = ({items, activeId, onSelect}: Props) => {
  const intl = useIntl()
  // Orden de recencia (ids, más reciente primero). El rail muestra los primeros MAX_RECENT.
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id))
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<{top: number; left: number}>({top: 0, left: 0})

  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

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

  const recent = pinned(order)
    .slice(0, MAX_RECENT)
    .map((id) => byId.get(id))
    .filter((i): i is RailItem => !!i)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.name.toLowerCase().includes(q))
  }, [items, query])

  const openSearch = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      let top = r.top + r.height / 2 - POPOVER_MAX_HEIGHT / 2
      top = Math.max(12, Math.min(top, window.innerHeight - POPOVER_MAX_HEIGHT - 12))
      const left = r.right + 12
      setPos({top, left})
    }
    setQuery('')
    setSearchOpen(true)
  }

  // Cerrar al hacer click afuera, con Escape, o al redimensionar (evita desalineación).
  useEffect(() => {
    if (!searchOpen) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setSearchOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    const onResize = () => setSearchOpen(false)
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [searchOpen])

  // Selecciona un ítem. Si es un colegio que NO está entre los recientes visibles, lo mueve al
  // FRENTE (más reciente) para que aparezca primero en el rail. "Plataforma" no rota.
  const pick = (item: RailItem) => {
    if (!item.isPlatform) {
      setOrder((prev) =>
        prev.slice(0, MAX_RECENT).includes(item.id)
          ? prev
          : [item.id, ...prev.filter((id) => id !== item.id)],
      )
    }
    onSelect(item)
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <>
      {/* begin::Recientes (selector) */}
      {recent.map((t) => {
        const active = t.id === activeId
        return (
          <button
            key={t.id}
            type='button'
            title={t.name}
            className='btn btn-icon btn-default mx-auto mb-4 p-0'
            onClick={() => pick(t)}
          >
            <div style={{boxShadow: active ? '0 0 0 3px var(--bs-primary)' : undefined, borderRadius: '50%'}}>
              <Face item={t} size={40} />
            </div>
          </button>
        )
      })}
      {/* end::Recientes */}

      {/* begin::Botón de búsqueda */}
      <button
        ref={btnRef}
        type='button'
        title={intl.formatMessage({id: 'impersonation.searchColegio', defaultMessage: 'Buscar colegio'})}
        className={`btn btn-icon btn-color-gray-600 btn-active-color-primary w-40px h-40px mx-auto mb-4${
          searchOpen ? ' active' : ''
        }`}
        onClick={() => (searchOpen ? setSearchOpen(false) : openSearch())}
      >
        <i className='ki-outline ki-magnifier fs-2'></i>
      </button>
      {/* end::Botón de búsqueda */}

      {/* begin::Popover (portal a body, no se recorta) */}
      {searchOpen &&
        createPortal(
          <div
            ref={popRef}
            className='bg-body rounded shadow-sm border border-gray-200 p-4'
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: POPOVER_WIDTH,
              maxHeight: POPOVER_MAX_HEIGHT,
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Buscador */}
            <div className='position-relative mb-3'>
              <i className='ki-outline ki-magnifier fs-3 text-gray-500 position-absolute top-50 translate-middle-y ms-3'></i>
              <input
                autoFocus
                type='text'
                className='form-control form-control-sm form-control-solid ps-10'
                placeholder={intl.formatMessage({
                  id: 'impersonation.searchPlaceholder',
                  defaultMessage: 'Buscar colegio...',
                })}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Lista con scroll (~9 visibles) */}
            <div className='scroll-y' style={{maxHeight: MAX_VISIBLE * 40, overflowY: 'auto'}}>
              {list.map((t) => {
                const active = t.id === activeId
                return (
                  <a
                    key={t.id}
                    href='#'
                    className={`d-flex align-items-center px-3 py-2 rounded bg-hover-light text-hover-primary${
                      active ? ' bg-light-primary' : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      pick(t)
                    }}
                  >
                    <div className='me-3'>
                      <Face item={t} size={30} />
                    </div>
                    <span className='flex-grow-1 fw-semibold fs-6 text-gray-800'>{t.name}</span>
                    {active && <i className='ki-solid ki-check fs-3 text-primary'></i>}
                  </a>
                )
              })}

              {list.length === 0 && (
                <div className='text-muted px-3 py-4 text-center fs-7'>
                  {intl.formatMessage({id: 'impersonation.noResults', defaultMessage: 'Sin resultados'})}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
      {/* end::Popover */}
    </>
  )
}

export {DesktopTeamRail}
