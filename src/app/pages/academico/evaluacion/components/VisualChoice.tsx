import type {EscalaOpcion} from '../../configuracion/configuracion.types'

export function VisualChoice({choice, compact = false}: {choice?: EscalaOpcion | null; compact?: boolean}) {
  if (!choice) return null
  return <span className='d-inline-flex align-items-center gap-1' title={choice.nombre}>
    {choice.imagen_url
      ? <img src={choice.imagen_url} alt='' width={compact ? 22 : 30} height={compact ? 22 : 30}
          className='rounded-circle object-fit-cover' />
      : <span aria-hidden='true' style={{fontSize: compact ? 20 : 27, lineHeight: 1}}>{choice.emoji || '🙂'}</span>}
    <span className={compact ? 'fs-8' : 'fs-7'}>{choice.nombre}</span>
  </span>
}
