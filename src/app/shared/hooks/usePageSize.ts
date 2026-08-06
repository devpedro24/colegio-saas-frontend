import {useCallback, useState, useEffect} from 'react'

const STORAGE_KEY = 'colegio-saas.page-size'
const DEFAULT_PAGE_SIZE = 5

export function usePageSize(): [number, (size: number) => void] {
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if ([5, 10, 15, 20, 25, 50].includes(parsed)) {
        return parsed
      }
    }
    return DEFAULT_PAGE_SIZE
  })

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const parsed = parseInt(e.newValue, 10)
        if ([5, 10, 15, 20, 25, 50].includes(parsed)) {
          setPageSizeState(parsed)
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const setPageSize = useCallback((size: number) => {
    localStorage.setItem(STORAGE_KEY, String(size))
    setPageSizeState(size)
  }, [])

  return [pageSize, setPageSize]
}
