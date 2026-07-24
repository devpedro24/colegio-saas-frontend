import { useCallback } from "react";
import { Link, useLocation } from "react-router";
import { useIntl } from "react-intl";
import { MENU_SIDEBAR, MENU_SIDEBAR_PLATFORM } from "@/config/dashboard.config";
import { useAuth } from "@/features/auth/auth-context";
import {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuItem,
  AccordionMenuLabel,
} from '@/components/ui/accordion-menu';
import { ScrollArea } from "@/components/ui/scroll-area";

export function SidebarMenu() {
  const { pathname } = useLocation();
  const intl = useIntl();
  const { user } = useAuth();

  // El superadministrador ve el menu de plataforma; el resto, el del colegio.
  const menu = user?.is_platform ? MENU_SIDEBAR_PLATFORM : MENU_SIDEBAR;

  // Memoize matchPath to prevent unnecessary re-renders
  const matchPath = useCallback(
    (path: string): boolean =>
      path === pathname || (path.length > 1 && pathname.startsWith(path) && path !== '/dashboard'),
    [pathname],
  );

  return (
    <ScrollArea className="grow h-[calc(100vh-16rem)] lg:h-[calc(100vh-17.5rem)] my-2.5 lg:my-7.5 px-2.5 me-0.5 pe-2">
      <AccordionMenu
        selectedValue={pathname}
        matchPath={matchPath}
        type="multiple"
        className="space-y-7.5"
        classNames={{
          separator: '-mx-2 mb-2.5',
          label: 'text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:in-data-[sidebar-open=false]:hidden',
          item: 'h-9 px-2.5 rounded-lg text-sm font-medium text-foreground hover:text-primary hover:bg-primary/5 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground [&[data-selected=true]_svg]:opacity-100 lg:in-data-[sidebar-open=false]:h-10 lg:in-data-[sidebar-open=false]:justify-center lg:in-data-[sidebar-open=false]:[&>a]:justify-center',
          group: '',
        }}
      >
        {menu.map((item, index) => {
          return (
            <AccordionMenuGroup key={index}>
              <AccordionMenuLabel>
                {intl.formatMessage({ id: item.title })}
              </AccordionMenuLabel>
              {item.children?.map((child, index) => {
                return (
                  <AccordionMenuItem key={index} value={child.path || '#'}>
                    <Link to={child.path || '#'} title={intl.formatMessage({ id: child.title })}>
                      {child.icon && <child.icon />}
                      <span className="lg:in-data-[sidebar-open=false]:hidden">
                        {intl.formatMessage({ id: child.title })}
                      </span>
                    </Link>
                  </AccordionMenuItem>
                )
              })}
            </AccordionMenuGroup>
          )
        })}
      </AccordionMenu>
    </ScrollArea>
  );
}
