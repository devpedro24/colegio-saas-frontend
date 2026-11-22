# React + TypeScript + Vite

Resumen de los módulos entregados y sus límites: [docs/ENTREGAS_2026-09.md](docs/ENTREGAS_2026-09.md).

Ingreso estudiantil: [portal, permisos y prueba de navegador](docs/INGRESO_ESTUDIANTIL.md). Matrículas por enlace sin pagos ni cuentas de acudiente.

## Imagen y vista previa del login

La imagen personalizada cubre todo el panel derecho mediante `object-fit: cover`, con títulos y textos superpuestos. Sin personalización permanece el fondo azul con la ilustración base. `AuthScreen` es la presentación compartida por el login y por **Previsualizar login** en la configuración de imágenes.

La vista previa ofrece escritorio y móvil en un iframe de solo lectura con los mismos estilos y puntos de ruptura. Usa el archivo local seleccionado antes de guardar; abrirla, cambiar el tamaño o cerrarla no realiza escrituras ni autenticación. El contexto plataforma/colegio se pasa expresamente para mostrar el copyright o la entrada a matrículas que corresponda.

Verificación aislada con imágenes del repositorio, API simulada y perfil temporal de Edge: `node --experimental-websocket scripts/login-appearance-smoke.mjs` (Node 20). Las capturas se guardan en `artifacts/login-appearance-smoke`; no utiliza cuentas ni modifica colegios reales.

## Recuperación de contraseña

`/auth/forgot-password` ofrece enlace por correo (30 minutos) y código OTP por correo (6 dígitos, 10 minutos y 5 intentos). Incluye espera entre reenvíos, expiración y mensajes genéricos. El código y el desafío solo permanecen en memoria durante el formulario; no se guardan en el navegador. Cambiar método conserva la espera de reenvío. El TOTP de MFA es independiente.

Prueba visual aislada sin correo real: `node --experimental-websocket scripts/password-recovery-smoke.mjs`. Cubre las dos opciones, código erróneo, reenvío, vencimiento, límite de solicitudes y vistas de 320/390 píxeles; las capturas están en `artifacts/password-recovery-smoke`.

## Centro de soporte

El footer muestra **GirGit Software** y enlaza **Soporte** con `/soporte`. El rector puede crear un ticket, enviar mensajes, consultar estados y cerrar/reabrir su caso. Plataforma dispone de la bandeja global en la misma ruta, accesible también desde Configuración. Otros roles reciben orientación para contactar al rector. La conversación usa texto plano y no concede autorización para acceder técnicamente al colegio.

Las API utilizan tokens públicos, cookies y CSRF. Los borradores del formulario permanecen en memoria; los reintentos conservan una clave de acción para evitar duplicados. El tiempo real distingue `support-inbox` de Plataforma y `support-tickets` del colegio, sin refrescar módulos académicos.

Prueba visual con cuentas y API simuladas, sin tickets reales: `node --experimental-websocket scripts/browser-smoke.mjs --support`. Verifica footer, creación, respuesta de ambos lados, estados, cierre/reapertura, aislamiento visual por rol, texto escapado y anchos de 320/390 píxeles. Capturas: `artifacts/ui-smoke/support-*`.

## Cuenta, logo y suscripción

Cuenta: `/account/settings` permite guardar una foto propia con previsualización local. El encabezado y el menú usan la foto privada, o iniciales si no existe. Plataforma conserva su identidad al administrar un colegio. El rector o soporte de plataforma puede editar el logo principal en `/ajustes-institucionales/datos`.

`/account/subscription` muestra el contrato real del colegio principal al rector o soporte dentro del colegio. «Mejorar plan», incluido el acceso móvil, solo aparece al rector real. El comparador no compra ni modifica contratos: los cambios comerciales siguen en Plataforma. Prueba de cuenta, foto y suscripción con datos aislados: `node --experimental-websocket scripts/browser-smoke.mjs --account`.

## Actualizaciones con Reverb

`WebSocketManager` mantiene una conexión durante toda la sesión, con canales
separados para plataforma y colegio. Durante la suplantación utiliza el token del
colegio y `X-Tenant` para autorizar su canal. La navegación no elimina sus escuchas.

`src/lib/realtime.ts` relaciona cada cambio con sus consultas dependientes. Solo
se vuelven a consultar las vistas activas; las demás quedan pendientes de
actualización al abrirlas. Se mantienen los filtros, y los formularios de perfil,
institución y SIEE conservan sus cambios sin guardar. Cada reconexión recupera los
datos que pudieron cambiar durante el corte. Las mutaciones locales usan el mismo
mapa, incluso cuando se pierde temporalmente el WebSocket.

Pruebas: `npm test`, `npm run build` y `npm run test:ui:realtime`.
La última necesita el Reverb del backend en ejecución y PHP disponible en PATH;
usa un navegador aislado, datos simulados y el canal de prueba `tenant.smoke`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
   parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
   },
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
