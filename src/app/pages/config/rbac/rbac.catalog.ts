// Helpers puros del catalogo RBAC (sin etiquetas hardcodeadas: los textos se
// resuelven por i18n en los componentes). El backend envia las labels de
// features/categorias como claves i18n, y los niveles/tipos se mapean a claves
// rbac.level.* / rbac.cellType.* en messages/{es,en}.json.

import type {CellState, RbacMatrixCell} from './rbac.types'

/** Clasifica una celda de la matriz; ausente = denegado. */
export const toCellState = (cell?: RbacMatrixCell): CellState =>
  cell
    ? {type: cell.type, level: cell.level, default_granted: cell.default_granted}
    : {type: 'denied', level: null, default_granted: false}
