# Eventos y calendario — 14 de octubre de 2026

Pantalla `/comunicacion/eventos`: crea eventos manuales, guarda borradores privados y publica. La categoría «Tarea» solo aparece en la leyenda y en entradas proyectadas del Aula; no es una opción del formulario. Al abrirla se navega al recurso real del Aula, sin editor de evento.

El calendario carga todas las páginas de eventos y de tareas autorizadas del mes. Las tareas con plazo aparecen en entrega; sin plazo, en publicación. La etiqueta distingue la fuente. Las mutaciones de recursos/secciones del Aula invalidan el calendario; el backend vuelve a comprobar permisos y visibilidad.

El formulario permite «Guardar borrador» o «Publicar evento». Primero se guarda, luego se suben adjuntos y solo después se publica; si falla un adjunto, se conserva el selector para no duplicar el evento al reintentar. Los cambios de alcance/notificación quedan bloqueados tras publicar, igual que en backend.

La casilla de correo empieza apagada. Indica estudiantes del grupo/colegio, excluyendo docentes y representantes. El detalle editable muestra pendientes, en curso, aceptados por SMTP, fallidos y cancelados, con reintento acotado. Los éxitos/errores de acciones usan el toast existente. Las etiquetas nuevas están traducidas ES/EN; las flechas de calendario usan KeenIcons.

El enlace del correo abre el detalle mediante `?evento=<selector>`. El login conserva solo ese selector validado, nunca destinos externos ni datos personales en almacenamiento del navegador.

## Comprobación

```sh
npm run test:ui:events
npm test
npm run check:i18n
npm run build
```

`scripts/events-smoke.mjs` ejercita borrador, publicación, correo opcional, estados/reintento, bloqueo de alcance, tareas, enlace directo, español/inglés y escritorio/móvil. Renderiza la plantilla real de Laravel con datos sintéticos para revisión visual. Capturas en `artifacts/ui-smoke/events-*.png` (no versionadas).

Resultado local: 53 pruebas unitarias aprobadas; 1.558 claves estáticas sin ausencias ES/EN; compilación y presupuesto de bundles aprobados; recorrido de eventos en navegador aprobado. La regresión backend completa terminó con 374 pruebas aprobadas y 3.510 aserciones. No son pruebas de entrega a buzones reales.

Contrato, migración y requisitos de worker/scheduler en `colegio-saas-backend/docs/EVENTOS_Y_CALENDARIO.md`. El 14 de octubre se activaron el scheduler y el listener dedicado en la sesión local de Windows, con recuperación y arranque al iniciar sesión. Una única prueba autorizada usó el correo institucional y la plantilla real: fue aceptada por SMTP; la llegada/renderizado en Gmail requiere confirmación del destinatario. No se publicaron eventos de prueba ni se enviaron avisos a estudiantes. No es un despliegue de producción.
