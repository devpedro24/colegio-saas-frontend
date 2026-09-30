import {useCallback, useState, useEffect} from 'react'

const STORAGE_KEY = 'colegio-saas.page-size'
const DEFAULT_PAGE_SIZE = 5
const allowed = [5, 10, 20, 50, 100, 1000]

export function usePageSize(listKey?: string): [number, (size: number) => void] {
  const storageKey = listKey ? `${STORAGE_KEY}.${listKey}` : STORAGE_KEY
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (allowed.includes(parsed)) {
        return parsed
      }
    }
    return DEFAULT_PAGE_SIZE
  })

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const parsed = parseInt(e.newValue, 10)
        if (allowed.includes(parsed)) {
          setPageSizeState(parsed)
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [storageKey])

  const setPageSize = useCallback((size: number) => {
    if (!allowed.includes(size)) return
    localStorage.setItem(storageKey, String(size))
    setPageSizeState(size)
  }, [storageKey])

  return [pageSize, setPageSize]
}
