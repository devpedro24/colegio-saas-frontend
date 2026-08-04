// Sistema de toasts ligero y reutilizable, construido sobre react-bootstrap
// (ya es dependencia del proyecto; el frontend nuevo no traia libreria de toasts).
// Uso: envolver la app con <ToastProvider> y disparar con const {success,error}=useToast().

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react'
import {Toast, ToastContainer} from 'react-bootstrap'

type ToastVariant = 'success' | 'danger' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastApi {
  show: (message: string, variant?: ToastVariant) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Hook para disparar toasts desde cualquier componente bajo <ToastProvider>. */
export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>')
  }
  return ctx
}

let counter = 0

export const ToastProvider: FC<{children: ReactNode}> = ({children}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++counter
    setToasts((prev) => [...prev, {id, message, variant}])
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'danger'),
    }),
    [show]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer
        className='p-3'
        position='top-end'
        containerPosition='fixed'
        style={{zIndex: 2000}}
      >
        {toasts.map((t) => (
          <Toast key={t.id} bg={t.variant} onClose={() => remove(t.id)} delay={4000} autohide>
            <Toast.Body className={t.variant === 'warning' ? 'text-dark' : 'text-white'}>
              {t.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  )
}
