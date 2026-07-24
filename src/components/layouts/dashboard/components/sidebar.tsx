import { SidebarMenu } from './sidebar-menu';
import { SidebarHeader } from './sidebar-header';

export function Sidebar() {
  return (
    <div className="flex flex-col items-stretch shrink-0 w-(--sidebar-width) lg:in-data-[sidebar-open=false]:w-(--sidebar-width-icon) transition-[width] duration-300 overflow-hidden">
      <div className="flex flex-col items-stretch shrink-0 w-(--sidebar-width) lg:in-data-[sidebar-open=false]:w-(--sidebar-width-icon) border-e border-border bg-background transition-[width] duration-300">
        <SidebarHeader />
        <SidebarMenu />
      </div>
    </div>
  );
}
