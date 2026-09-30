type TimedSession = {id: string} & (
  {bloque: {hora_inicio: string; hora_fin: string}; hora_inicio: null; hora_fin: null} |
  {bloque: null; hora_inicio: string; hora_fin: string}
)

export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
export const sessionStart = (session: TimedSession): string => session.bloque === null ? session.hora_inicio : session.bloque.hora_inicio
export const sessionEnd = (session: TimedSession): string => session.bloque === null ? session.hora_fin : session.bloque.hora_fin

// Assign columns to overlapping intervals without changing the caller's ordering.
export function layoutSessions<T extends TimedSession>(sessions: T[]) {
  const sorted = [...sessions].sort((a, b) => minutes(sessionStart(a)) - minutes(sessionStart(b)) || a.id.localeCompare(b.id))
  const result: {session: T; lane: number; lanes: number}[] = []
  let cluster: typeof result = []
  let ends: number[] = []
  let clusterEnd = -1
  const flush = () => {
    cluster.forEach(item => {item.lanes = ends.length})
    result.push(...cluster)
    cluster = []
    ends = []
  }
  for (const session of sorted) {
    const start = minutes(sessionStart(session))
    const end = minutes(sessionEnd(session))
    if (start >= clusterEnd) flush()
    let lane = ends.findIndex(value => value <= start)
    if (lane < 0) lane = ends.length
    ends[lane] = end
    cluster.push({session, lane, lanes: 1})
    clusterEnd = cluster.length === 1 ? end : Math.max(clusterEnd, end)
  }
  flush()
  return result
}
