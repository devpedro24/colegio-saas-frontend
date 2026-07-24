import { Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { PermissionCell as Cell } from '../types';

/** Etiquetas legibles del nivel estructural. */
const LEVEL_LABELS: Record<string, string> = {
  crud: 'Total',
  editar: 'Editar',
  ver: 'Ver',
  reportar: 'Reportar',
  aprobar: 'Aprobar',
  c: 'Aporta',
  auto: 'Auto',
};

interface PermissionCellProps {
  cell: Cell | undefined;
  onToggle: (granted: boolean) => void;
  disabled?: boolean;
}

/** Renderiza una celda segun su capa: estructural (fijo), configurable (switch) o denegado. */
export function PermissionCell({ cell, onToggle, disabled }: PermissionCellProps) {
  // Bloqueado por el plan: candado con upsell (tiene prioridad sobre la capa).
  if (cell?.locked_by_plan) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
        title={`Disponible en un plan superior${cell.required_feature ? ` (${cell.required_feature})` : ''}`}
      >
        <Lock className="size-3" />
        Plan
      </span>
    );
  }

  if (!cell || cell.type === 'denied') {
    return <span className="text-muted-foreground/30">—</span>;
  }

  if (cell.type === 'structural') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
        title="Permiso estructural: no se puede modificar"
      >
        <Lock className="size-3" />
        {cell.level ? (LEVEL_LABELS[cell.level] ?? cell.level) : 'Si'}
      </span>
    );
  }

  // Configurable: unico caso editable.
  return (
    <Switch
      size="sm"
      checked={cell.granted}
      onCheckedChange={onToggle}
      disabled={disabled}
    />
  );
}
