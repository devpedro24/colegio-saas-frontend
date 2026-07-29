# Estado del proyecto — Frontend (ex demo1 de Metronic, rediseñado a demo46)

> **IMPORTANTE:** a la fecha **TODO es VISUAL / diseño (datos mock)**. **NO hay backend conectado ni funcionalidades reales**. Este documento deja constancia de lo construido y de la **funcionalidad prevista** de cada módulo (tomada de `colegio-saas-frontend` y `colegio-saas-backend`), para no perder ese conocimiento cuando se elimine `colegio-saas-frontend`.

---

## 1. Base y marca
- Base técnica: **Metronic React demo1** (React + Vite + TypeScript + Bootstrap/Metronic), **rediseñado con el look de demo46** (header violeta, rail de caritas, contenido redondeado, fondo crema).
- SASS: **transplantado de demo46** (fuente única). **Bootstrap 5.3.8**.
- **Marca Metronic/KeenThemes ELIMINADA** (nombre, logos, favicon, splash). Placeholder neutro: **"Colegio SaaS"** (cambiar por la marca real cuando exista).
- Login **mock local**: `admin@demo.com` / `demo` (sin backend). **Sign Out** funciona (limpia sesión local y redirige al login).
- App corre en la **raíz** (`/`), sin el prefijo `/metronic8/react/demo1/`.

## 2. Shell / Layout (visual)
- **Header** (violeta demo46): logo de texto "Colegio SaaS"; menú **Apps** y **Configuración** (dropdowns que abren por hover; en móvil, acordeón hacia abajo); navbar de acciones: Upgrade Plan (modal), búsqueda, notificaciones, quick-menu, **menú de usuario**.
  - Menú de usuario: My Profile → `/account/overview`; **Mode** (claro/oscuro/sistema) funcional; **Idioma** ES/EN funcional (marca activo); Sign Out funcional.
- **Sidebar rail de caritas** (desktop, 70px): **5 recientes** (selector, la activa con anillo) + **buscador** (popover a la derecha, portal, no se recorta); orden **MRU** (al elegir uno lejano pasa al primero). Botón **"+"** reservado para función futura.
- **Móvil**: **sidebar unificado** (drawer por hamburguesa) = selector "Thunder" de caritas (avatar+nombre, 5 recientes + buscador con scroll) + menú **Apps** vertical. Dropdowns de notificaciones/quick/search **responsive**. En pantallas muy chicas (<576px) el **Upgrade** pasa al fondo del sidebar para no tapar al usuario.
- **Footer** y **toolbar dinámico** (título/breadcrumb por página, vía PageTitle).
- **Tema claro/oscuro** operativo (ThemeMode nativo). **Idioma** ES/EN (fija el locale; el contenido demo es texto estático, aún sin i18n real).

## 3. Páginas construidas (visual)
- **Dashboard** eCommerce de demo46 (charts con ApexCharts) — visual.
- **Cuenta** (My Profile):
  - `/account/overview` → header de cuenta + card **Profile Details**.
  - `/account/settings` → formularios (Profile Details, Sign-in Method, Connected Accounts, Email Preferences, Notifications, Deactivate) — solo UI.
- **Configuración** (NUEVO — basado en `colegio-saas-frontend`, rediseñado a demo46, **solo diseño + mock**):
  - `/configuracion/colegios` → tabla (Nombre, Subdominio, Plan, Estado, Acciones) + búsqueda; modales **Crear / Editar / Eliminar** + **Contraseña del rector** + switch **Habilitar/Inhabilitar**.
  - `/configuracion/planes` → cards de planes (nombre, precio, descripción, features); modal **Crear/Editar** (con descripción + lista de features) + **Eliminar**.
  - `/configuracion/roles-permisos` → card con tabs **Permisos / Roles / Matriz**; tablas de permisos y roles con modales **Crear/Editar/Eliminar**; **matriz** roles×módulos con estados (estructural/configurable/denegado) y gating.

## 4. Arquitectura (limpia, por feature)
```
src/app/pages/config/
  ConfigPage.tsx            (router de la sección)
  colegios/ ColegiosPage.tsx + components/ + colegios.types.ts + colegios.mock.ts
  planes/   PlanesPage.tsx   + components/ + planes.types.ts   + planes.mock.ts
  rbac/     RbacPage.tsx      + components/ + rbac.types.ts     + rbac.mock.ts
```
(espeja la organización de `colegio-saas-frontend/src/features/`).

## 5. Funcionalidad PREVISTA por módulo (a implementar con backend) — NO perder
> El feature ya estaba trabajado en `colegio-saas-frontend` (TanStack Query + react-intl) y `colegio-saas-backend` (Laravel 12 + stancl/tenancy + spatie/permission + Sanctum + Reverb).

- **Colegios (multi-tenant):** alta de colegio (name, subdomain, plan) con provisioning; estados `active / configuring / provisioning / suspended` (suspendido bloquea el subdominio); editar; **regenerar contraseña del rector**; habilitar/inhabilitar.
- **Planes:** catálogo central editable por superadmin (esencial / estándar / premium) con **features**; el plan del colegio condiciona el gating de RBAC.
- **RBAC (roles y permisos):** catálogo **central editable por el superadmin** (permisos, roles, matriz global). Matriz por celda: **estructural / configurable / denegado**; **gating por plan/feature** (candado + upsell cuando la feature no está en el plan). El rector configura solo lo desbloqueado. Comando `rbac:sync` propaga a tenants. spatie en cada tenant guarda los grants.
- **Tiempo real:** notificaciones vía **Laravel Reverb** (canales privados por colegio).
- **i18n:** claves semánticas es/en (react-intl) en todo el contenido real.

## 6. Lo que FALTA (pendiente)
- Conectar **Colegios / Planes / RBAC** al backend real (hoy son `.mock.ts`).
- Reemplazar todo el contenido demo estático por datos reales + **i18n real** (es/en).
- Wiring de las acciones de los modales (crear/editar/eliminar) a la API.
- RBAC: matriz editable persistente + gating por plan + `rbac:sync`.
- Notificaciones en tiempo real (Reverb).
- Marca real (logo/favicon) en lugar del placeholder "Colegio SaaS".

## Referencias
- Feature original: `colegio-saas-frontend/src/features/{colegios,planes,rbac-admin}` y `colegio-saas-backend`.
