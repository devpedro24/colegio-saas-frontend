import {useState, useEffect} from 'react'

/** true = tenant existe, false = no existe, null = cargando */
export function useTenantStatus(): boolean | null {
  const [status, setStatus] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tenant-status', {headers: {Accept: 'application/json'}})
      .then((res) => {
        if (!cancelled) setStatus(res.ok)
      })
      .catch(() => {
        if (!cancelled) setStatus(false)
      })
    return () => { cancelled = true }
  }, [])

  return status
}
