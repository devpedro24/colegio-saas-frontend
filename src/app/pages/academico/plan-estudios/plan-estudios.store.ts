// Store "vanilla" (subscribe + useSyncExternalStore) para el feature Plan de
// estudios. Datos FICTICIOS e interactivos en memoria (sin backend todavía):
// áreas, materias, asignación docente y sesiones de horario. Mismo patrón que
// `impersonation.store.ts`. Al existir API, esta capa se reemplaza por
// TanStack Query sin tocar las páginas/tabs que la consumen.

import {useSyncExternalStore} from 'react'
import type {
  Area,
  AsignacionDocente,
  CreateAreaInput,
  CreateAsignacionInput,
  CreateMateriaInput,
  CreateSesionInput,
  Materia,
  SesionHorario,
  TipoConflicto,
} from './plan-estudios.types'

interface PlanEstudiosState {
  areas: Area[]
  materias: Materia[]
  asignaciones: AsignacionDocente[]
  sesiones: SesionHorario[]
}

let seq = 0
const nextId = (prefix: string): string => `${prefix}-${++seq}`

function seedAreasYMaterias(): {areas: Area[]; materias: Materia[]} {
  const matematicas: Area = {id: nextId('area'), nombre: 'Matemáticas', descripcion: null, estado: 'activo'}
  const ciencias: Area = {
    id: nextId('area'),
    nombre: 'Ciencias Naturales',
    descripcion: null,
    estado: 'activo',
  }
  const humanidades: Area = {id: nextId('area'), nombre: 'Humanidades', descripcion: null, estado: 'activo'}

  const materias: Materia[] = [
    {id: nextId('materia'), area_id: matematicas.id, nombre: 'Matemáticas', intensidad_horaria: 5, nivel_id: null, estado: 'activo'},
    {id: nextId('materia'), area_id: matematicas.id, nombre: 'Geometría', intensidad_horaria: 2, nivel_id: null, estado: 'activo'},
    {id: nextId('materia'), area_id: ciencias.id, nombre: 'Biología', intensidad_horaria: 3, nivel_id: null, estado: 'activo'},
    {id: nextId('materia'), area_id: ciencias.id, nombre: 'Física', intensidad_horaria: 3, nivel_id: null, estado: 'activo'},
    {id: nextId('materia'), area_id: humanidades.id, nombre: 'Español', intensidad_horaria: 4, nivel_id: null, estado: 'activo'},
    {id: nextId('materia'), area_id: humanidades.id, nombre: 'Inglés', intensidad_horaria: 3, nivel_id: null, estado: 'activo'},
  ]

  return {areas: [matematicas, ciencias, humanidades], materias}
}

const seeded = seedAreasYMaterias()

let state: PlanEstudiosState = {
  areas: seeded.areas,
  materias: seeded.materias,
  asignaciones: [],
  sesiones: [],
}

const listeners = new Set<() => void>()
function emit(): void {
  listeners.forEach((l) => l())
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot(): PlanEstudiosState {
  return state
}

/** Snapshot reactivo del store completo (áreas, materias, asignaciones, sesiones). */
export function usePlanEstudiosStore(): PlanEstudiosState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// ---- Áreas ----

export function crearArea(input: CreateAreaInput): Area {
  const area: Area = {
    id: nextId('area'),
    nombre: input.nombre,
    descripcion: input.descripcion ?? null,
    estado: input.estado ?? 'activo',
  }
  state = {...state, areas: [...state.areas, area]}
  emit()
  return area
}

export function actualizarArea(id: string, input: CreateAreaInput): void {
  state = {
    ...state,
    areas: state.areas.map((a) =>
      a.id === id
        ? {...a, nombre: input.nombre, descripcion: input.descripcion ?? null, estado: input.estado ?? a.estado}
        : a
    ),
  }
  emit()
}

/** Elimina el área y, en cascada, sus materias, asignaciones y sesiones dependientes. */
export function eliminarArea(id: string): void {
  const materiaIds = new Set(state.materias.filter((m) => m.area_id === id).map((m) => m.id))
  const asignacionIds = new Set(
    state.asignaciones.filter((a) => materiaIds.has(a.materia_id)).map((a) => a.id)
  )
  state = {
    areas: state.areas.filter((a) => a.id !== id),
    materias: state.materias.filter((m) => m.area_id !== id),
    asignaciones: state.asignaciones.filter((a) => !materiaIds.has(a.materia_id)),
    sesiones: state.sesiones.filter((s) => !asignacionIds.has(s.asignacion_id)),
  }
  emit()
}

// ---- Materias ----

export function crearMateria(input: CreateMateriaInput): Materia {
  const materia: Materia = {
    id: nextId('materia'),
    area_id: input.area_id,
    nombre: input.nombre,
    intensidad_horaria: input.intensidad_horaria,
    nivel_id: input.nivel_id ?? null,
    estado: input.estado ?? 'activo',
  }
  state = {...state, materias: [...state.materias, materia]}
  emit()
  return materia
}

export function actualizarMateria(id: string, input: CreateMateriaInput): void {
  state = {
    ...state,
    materias: state.materias.map((m) =>
      m.id === id
        ? {
            ...m,
            area_id: input.area_id,
            nombre: input.nombre,
            intensidad_horaria: input.intensidad_horaria,
            nivel_id: input.nivel_id ?? null,
            estado: input.estado ?? m.estado,
          }
        : m
    ),
  }
  emit()
}

/** Elimina la materia y, en cascada, sus asignaciones y sesiones dependientes. */
export function eliminarMateria(id: string): void {
  const asignacionIds = new Set(state.asignaciones.filter((a) => a.materia_id === id).map((a) => a.id))
  state = {
    ...state,
    materias: state.materias.filter((m) => m.id !== id),
    asignaciones: state.asignaciones.filter((a) => a.materia_id !== id),
    sesiones: state.sesiones.filter((s) => !asignacionIds.has(s.asignacion_id)),
  }
  emit()
}

// ---- Asignación docente ----

/** Crea la asignación; devuelve null si ya existe la misma combinación (duplicada). */
export function crearAsignacion(input: CreateAsignacionInput): AsignacionDocente | null {
  const duplicada = state.asignaciones.some(
    (a) =>
      a.docente_id === input.docente_id &&
      a.materia_id === input.materia_id &&
      a.grupo_id === input.grupo_id &&
      a.ano_lectivo_id === input.ano_lectivo_id
  )
  if (duplicada) return null

  const asignacion: AsignacionDocente = {id: nextId('asignacion'), ...input}
  state = {...state, asignaciones: [...state.asignaciones, asignacion]}
  emit()
  return asignacion
}

/** Elimina la asignación y, en cascada, sus sesiones de horario. */
export function eliminarAsignacion(id: string): void {
  state = {
    ...state,
    asignaciones: state.asignaciones.filter((a) => a.id !== id),
    sesiones: state.sesiones.filter((s) => s.asignacion_id !== id),
  }
  emit()
}

// ---- Horarios (sesiones) ----

/**
 * Motor de conflictos (anticipo de UX): mismo día + mismo bloque horario y
 * (mismo docente | mismo grupo | mismo espacio físico). El backend deberá
 * revalidar y bloquear de forma autoritativa (RN-HO / motor de horarios).
 */
export function detectarConflictos(
  candidato: CreateSesionInput,
  contexto: {grupoId: string; docenteId: string},
  excluirSesionId?: string
): TipoConflicto[] {
  const tipos = new Set<TipoConflicto>()

  const mismosSlot = state.sesiones.filter(
    (s) => s.id !== excluirSesionId && s.dia === candidato.dia && s.bloque_horario_id === candidato.bloque_horario_id
  )

  for (const sesion of mismosSlot) {
    const asignacion = state.asignaciones.find((a) => a.id === sesion.asignacion_id)
    if (!asignacion) continue
    if (asignacion.docente_id === contexto.docenteId) tipos.add('docente')
    if (asignacion.grupo_id === contexto.grupoId) tipos.add('grupo')
    if (candidato.espacio_fisico_id && sesion.espacio_fisico_id === candidato.espacio_fisico_id) {
      tipos.add('espacio')
    }
  }

  return Array.from(tipos)
}

/** Crea la sesión si no hay conflictos; si los hay, no persiste y los devuelve. */
export function crearSesion(
  input: CreateSesionInput,
  contexto: {grupoId: string; docenteId: string}
): {sesion: SesionHorario | null; conflictos: TipoConflicto[]} {
  const conflictos = detectarConflictos(input, contexto)
  if (conflictos.length > 0) return {sesion: null, conflictos}

  const sesion: SesionHorario = {
    id: nextId('sesion'),
    asignacion_id: input.asignacion_id,
    dia: input.dia,
    bloque_horario_id: input.bloque_horario_id,
    espacio_fisico_id: input.espacio_fisico_id ?? null,
  }
  state = {...state, sesiones: [...state.sesiones, sesion]}
  emit()
  return {sesion, conflictos: []}
}

export function eliminarSesion(id: string): void {
  state = {...state, sesiones: state.sesiones.filter((s) => s.id !== id)}
  emit()
}
