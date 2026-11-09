import {createContext, useContext} from 'react'

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info' | 'updated' | 'deleted'
export type ToastApi = {
  show: (message: string, variant?: ToastVariant) => void
  success: (message: string, variant?: 'success' | 'updated' | 'deleted') => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}
export const ToastContext = createContext<ToastApi | null>(null)
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return api
}
