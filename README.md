# Colegio SaaS — Frontend

Aplicación web de la plataforma multi-tenant para gestión académica. Está construida con React 19, TypeScript, Vite, React Query y la base visual Metronic.

## Requisitos

- Node.js 22 o superior.
- npm.
- Backend Laravel disponible en `http://127.0.0.1:8000`.
- Laravel Reverb en `http://127.0.0.1:8080` si se requiere sincronización en tiempo real.

## Configuración local

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Vite escucha en `http://localhost:5173` y redirige `/api` al backend conservando el host. Los tenants pueden abrirse como `http://<slug>.localhost:5173`.

Las variables de dominio y Reverb están documentadas en `.env.example`. Los archivos `.env` y `.env.*` no se versionan, excepto ese ejemplo.

## Comandos de verificación

```powershell
npm run lint
npm test
npm run build
```

Las pruebas de regresión usan el runner integrado de Node y cubren la selección de credenciales por ámbito, la construcción de dominios tenant y la expiración de sesiones de suplantación.

## Autenticación y tenancy

- Los tokens se guardan en `sessionStorage` y expiran según el contrato del backend.
- Durante una suplantación, las rutas tenant usan el token sombra y `X-Tenant`; las rutas de plataforma conservan la sesión del superadministrador.
- El endpoint privado de autorización WebSocket para tenant es `/api/tenant-broadcasting/auth`.
- El backend sigue siendo la autoridad final para permisos, MFA, estado del tenant y límites del plan.

## Producción

Configure `VITE_TENANT_BASE_DOMAIN`, `VITE_TENANT_SCHEME`, `VITE_CENTRAL_HOSTS` y las variables `VITE_REVERB_*` antes de ejecutar `npm run build`. `VITE_TENANT_BASE_DOMAIN` debe coincidir con `TENANT_BASE_DOMAIN` del backend y los hosts centrales deben estar registrados en `CENTRAL_DOMAINS`. El contenido generado queda en `dist/`.

Sirva ese mismo `dist/` tanto en el host central como en los subdominios tenant
y enrute `/api` hacia Laravel conservando `Host` (o un `X-Forwarded-Host`
confiable). El cliente usa URLs relativas para que el backend pueda identificar
el colegio por dominio; si el proxy reemplaza el host, las rutas tenant no se
resolverán correctamente.
