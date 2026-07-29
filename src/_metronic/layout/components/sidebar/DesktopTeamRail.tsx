import {useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {toAbsoluteUrl} from '../../../helpers'
import {Team} from './MobileTeamSelector'

type Props = {
  teams: Team[]
  defaultIndex?: number
}

// Misma lógica que el selector móvil (recientes + buscador con scroll ~9) pero adaptada al rail
// de 70px: los MAX_RECENT recientes como avatares seleccionables (ring primario en la activa) y
// un botón de búsqueda que abre un POPOVER a la derecha del rail. El popover se renderiza con
// createPortal a document.body (position: fixed) para NO ser recortado por el overflow del
// sidebar (hover-scroll-overlay-y); se posiciona junto al botón con getBoundingClientRect.
//
// Los 5 del rail son "last recent" (orden MRU): al seleccionar uno que NO está entre los
// recientes visibles (p.ej. desde el buscador), pasa al frente y aparece primero en el rail.
const MAX_RECENT = 5
const MAX_VISIBLE = 9
const POPOVER_WIDTH = 280
const POPOVER_MAX_HEIGHT = 440

const DesktopTeamRail = ({teams, defaultIndex = 0}: Props) => {
  const [selected, setSelected] = useState(defaultIndex)
  // Orden de recencia (índices de teams, más reciente primero). El rail muestra los primeros 5.
  const [order, setOrder] = useState<number[]>(() => teams.map((_, i) => i))
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<{top: number; left: number}>({top: 0, left: 0})

  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const recentIdx = order.slice(0, MAX_RECENT)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((t) => t.name.toLowerCase().includes(q))
  }, [teams, query])

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

  // Selecciona un colegio. Si NO está entre los recientes visibles, lo mueve al FRENTE (se
  // vuelve el más reciente) para que aparezca primero en el rail. Si ya es reciente, solo marca.
  const pick = (idx: number) => {
    setSelected(idx)
    setOrder((prev) =>
      prev.slice(0, MAX_RECENT).includes(idx) ? prev : [idx, ...prev.filter((i) => i !== idx)]
    )
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <>
      {/* begin::Recientes (selector) */}
      {recentIdx.map((idx) => {
        const t = teams[idx]
        const active = idx === selected
        return (
          <button
            key={idx}
            type='button'
            title={t.name}
            className='btn btn-icon btn-default mx-auto mb-4 p-0'
            onClick={() => pick(idx)}
          >
            <div
              className='symbol symbol-40px symbol-circle'
              style={{boxShadow: active ? '0 0 0 3px var(--bs-primary)' : undefined}}
            >
              <img src={toAbsoluteUrl(`media/avatars/${t.avatar}`)} alt={t.name} />
            </div>
          </button>
        )
      })}
      {/* end::Recientes */}

      {/* begin::Botón de búsqueda */}
      <button
        ref={btnRef}
        type='button'
        title='Buscar colegio'
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
                placeholder='Buscar colegio...'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Lista con scroll (~9 visibles) */}
            <div className='scroll-y' style={{maxHeight: MAX_VISIBLE * 40, overflowY: 'auto'}}>
              {list.map((t) => {
                const idx = teams.indexOf(t)
                const active = idx === selected
                return (
                  <a
                    key={idx}
                    href='#'
                    className={`d-flex align-items-center px-3 py-2 rounded bg-hover-light text-hover-primary${
                      active ? ' bg-light-primary' : ''
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      pick(idx)
                    }}
                  >
                    <div className='symbol symbol-30px me-3'>
                      <img src={toAbsoluteUrl(`media/avatars/${t.avatar}`)} alt={t.name} />
                    </div>
                    <span className='flex-grow-1 fw-semibold fs-6 text-gray-800'>{t.name}</span>
                    {active && <i className='ki-solid ki-check fs-3 text-primary'></i>}
                  </a>
                )
              })}

              {list.length === 0 && (
                <div className='text-muted px-3 py-4 text-center fs-7'>Sin resultados</div>
              )}
            </div>
          </div>,
          document.body
        )}
      {/* end::Popover */}
    </>
  )
}

export {DesktopTeamRail}
