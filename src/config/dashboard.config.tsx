import { MenuConfig } from "@/config/types";
import { ShieldUser, ShieldCheck, Building2, CreditCard, House, Users, Settings2, Network } from "lucide-react";

// Menu lateral del COLEGIO (rector).
export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'menu.administration',
    children: [
      {
        title: 'menu.rolesPermissions',
        path: '/configuracion/roles',
        icon: ShieldUser,
      },
    ],
  },
];

// Menu lateral del SUPERADMINISTRADOR (plataforma).
export const MENU_SIDEBAR_PLATFORM: MenuConfig = [
  {
    title: 'menu.platform',
    children: [
      {
        title: 'menu.schools',
        path: '/plataforma/colegios',
        icon: Building2,
      },
      {
        title: 'menu.plans',
        path: '/plataforma/planes',
        icon: CreditCard,
      },
      {
        title: 'menu.rbacGlobal',
        path: '/plataforma/roles-permisos',
        icon: ShieldCheck,
      },
    ],
  },
];

// Menu superior del header (barra oscura). Se conserva para uso futuro.
export const MENU_HEADER: MenuConfig = [
  {
    title: 'menu.h.dashboards',
    path: '/dashboard',
    icon: House,
  },
  {
    title: 'menu.h.publicProfile',
    path: '#',
    icon: Users,
  },
  {
    title: 'menu.h.accountSettings',
    path: '#',
    icon: Settings2,
  },
  {
    title: 'menu.h.network',
    path: '#',
    icon: Network,
  },
  {
    title: 'menu.h.authentication',
    path: '#',
    icon: ShieldUser,
  },
];
