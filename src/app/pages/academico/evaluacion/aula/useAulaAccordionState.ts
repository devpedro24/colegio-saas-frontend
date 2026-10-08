import {useState} from 'react'

type AccordionPanel = 'sidebar' | 'content'
type StoredState = {key: string | null; values: Record<string, boolean>}

function readState(key: string | null): Record<string, boolean> {
  if (!key) return {}
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, boolean] =>
      typeof entry[1] === 'boolean'))
  } catch {
    return {}
  }
}

/** Preferencia visual local por aula y panel; no almacena identidad ni contenido académico. */
export function useAulaAccordionState(aulaToken: string, panel: AccordionPanel) {
  const key = aulaToken ? `colegio-saas.aula.accordion.v1:${aulaToken}:${panel}` : null
  const [stored, setStored] = useState<StoredState>(() => ({key, values: readState(key)}))
  const values = stored.key === key ? stored.values : readState(key)

  const toggle = (sectionToken: string, defaultExpanded: boolean) => {
    const next = {...values, [sectionToken]: !(values[sectionToken] ?? defaultExpanded)}
    setStored({key, values: next})
    if (!key) return
    try {window.localStorage.setItem(key, JSON.stringify(next))}
    catch { /* La navegación sigue funcionando si el almacenamiento está deshabilitado. */ }
  }

  return {values, toggle}
}
