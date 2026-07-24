import { useState } from 'react';
import { Check, ChevronsUpDown, Gem, Hexagon, Layers2, PanelLeft, Zap } from 'lucide-react';
import { useLayout } from './context';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Team {
  icon: React.ElementType;
  name: string;
  color: string;
  members: number;
}

export function SidebarHeader() {
  const { sidebarToggle } = useLayout();

  const teams: Team[] = [
    { icon: Zap, name: 'Thunder AI', color: 'bg-blue-600 text-white', members: 8 },
    { icon: Gem, name: 'Clarity AI', color: 'bg-fuchsia-600 text-white', members: 6 },
    { icon: Hexagon, name: 'Lightning AI', color: 'bg-yellow-600 text-white', members: 12 },
    { icon: Layers2, name: 'Bold AI', color: 'bg-teal-600 text-white', members: 4 },
  ];

  const [selectedTeam, setSelectedTeam] = useState<Team>(teams[0]);

  return (
    <div className="flex min-h-[60px] items-center gap-1 border-b border-border px-3 lg:in-data-[sidebar-open=false]:flex-col lg:in-data-[sidebar-open=false]:justify-center lg:in-data-[sidebar-open=false]:gap-2 lg:in-data-[sidebar-open=false]:px-0 lg:in-data-[sidebar-open=false]:py-3">
      {/* Selector de equipo (Thunder AI...) — funcionalidad futura */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="grow justify-start gap-2.5 px-1.5 text-muted-foreground hover:text-foreground lg:in-data-[sidebar-open=false]:w-full lg:in-data-[sidebar-open=false]:grow-0 lg:in-data-[sidebar-open=false]:justify-center lg:in-data-[sidebar-open=false]:px-0"
          >
            <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', selectedTeam.color)}>
              <selectedTeam.icon className="size-5 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground lg:in-data-[sidebar-open=false]:hidden">
              {selectedTeam.name}
            </span>
            <ChevronsUpDown className="ms-auto size-4 opacity-60 lg:in-data-[sidebar-open=false]:hidden" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" side="bottom" align="start" sideOffset={10}>
          {teams.map((team) => (
            <DropdownMenuItem
              key={team.name}
              onClick={() => setSelectedTeam(team)}
              data-active={selectedTeam.name === team.name}
            >
              <div className={cn('flex size-6 items-center justify-center rounded-md', team.color)}>
                <team.icon className="size-4" />
              </div>
              <span className="text-sm font-medium text-foreground">{team.name}</span>
              {selectedTeam.name === team.name && <Check className="ms-auto size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Toggle: colapsa a un mini-sidebar con iconos (no lo esconde del todo) */}
      <Button
        mode="icon"
        variant="ghost"
        onClick={sidebarToggle}
        className="hidden shrink-0 text-muted-foreground hover:text-primary lg:inline-flex lg:in-data-[sidebar-open=false]:w-full lg:in-data-[sidebar-open=false]:justify-center"
      >
        <PanelLeft className="opacity-100 transition-transform in-data-[sidebar-open=false]:rotate-180" />
      </Button>
    </div>
  );
}
