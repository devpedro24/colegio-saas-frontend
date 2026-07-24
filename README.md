# Colegio SaaS — Frontend

Interfaz web de la **plataforma SaaS de gestión académica y de convivencia para
colegios de Colombia**. Consume el backend multi-tenant (`../colegio-saas-backend`).

- **Stack:** React 19 · Vite 7 · TypeScript · Tailwind CSS 4 · Radix UI · TanStack Query/Table · React Hook Form + Zod · React Router 7 · react-intl (i18n).

## Requisitos

- Node.js 20+
- npm 10+

## Puesta en marcha

```bash
npm install
npm run dev
```

La app abre en `http://localhost:5173` y entra directo al **dashboard**.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de producción (`tsc && vite build`) |
| `npm run preview` | Sirve el build de producción |
| `npm run lint` | Lint con ESLint |
| `npm run format` | Formatea con Prettier |

## Estructura

| Ruta | Qué es |
|---|---|
| `src/components/layouts/dashboard/` | Layout principal (header, sidebar, toolbar) |
| `src/pages/dashboard/` | Página del dashboard |
| `src/config/dashboard.config.tsx` | Menús del layout (sidebar / header) |
| `src/routing/` | Configuración de rutas (React Router) |
| `src/components/ui/` | Componentes de UI reutilizables |
| `src/styles/` | Estilos globales y de tema (Tailwind) |

## Idioma

El menú de perfil incluye un selector de idioma (Español / Inglés). El idioma por
defecto es **Español (es-CO)**.
