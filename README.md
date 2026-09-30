# React + TypeScript + Vite

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
