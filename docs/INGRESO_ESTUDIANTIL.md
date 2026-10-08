# Ingreso estudiantil

Administración en `/admisiones/solicitudes`, bajo el menú Ingreso estudiantil del header, sin barra de pestañas duplicada sobre el contenido. Conserva los accesos y permisos de Matrículas por enlace (documento), Admisiones «Próximamente» (persona con verificación) y Gestión de Matrículas académicas (libreta de registros), con íconos distintos. Portal público `/ingreso/:campaign?` accesible desde login del colegio, sin crear cuentas de acudiente.

## Pantallas

Gestión de Matrículas, Admisiones y Matrículas por enlace comparten `AcademicPageHeader` y las tarjetas del tema académico: mismo radio, sombra, tipografía y espaciado. La administración por enlace reutiliza `card-header`/`card-body`, selectores sólidos y tablas con separadores discontinuos. No se cambian los estilos independientes del portal público ni del correo institucional. El antiguo título «Admisiones y matrícula» pasa a «Gestión de Matrículas».

- Convocatorias: año, fechas, habilitación, grados/cupos, requisitos comunes/por grado, campos adicionales y texto de privacidad.
- Bandeja paginada por estado: documentos/versiones, motivos, decisiones, propuesta de cambio de grado y grupos individuales/automáticos con confirmación.
- Portal: correo/PIN, recuperación, guardado explícito de borrador, carga documental, consentimiento/envío y seguimiento.
- Dashboard estudiante aprobado sin grupo: aviso de asignación pendiente. Primer login exige solo contraseña, sin pasos institucionales.

Toda acción se muestra según `ingreso.*`, pero el servidor vuelve a autorizar. `ingreso.ver` es requisito de las operaciones sobre expedientes. Secretaría y coordinación solo reciben acceso al habilitar sus permisos configurables. Capacidad comercial `academico`.

## Datos y comunicaciones

TanStack Query mantiene catálogo/listado en memoria con claves de colegio y campaña. Los avisos `enrollment-intake` invalidan solo consultas `ingreso`; no disparan recargas generales de onboarding/SIEE/horarios por cada documento. El cliente compartido conserva deduplicación de GET, CSRF y protección de contexto.

El portal usa cookie HttpOnly de matrícula y CSRF independiente; un 401 público no expulsa la sesión institucional del personal. No se almacenan PIN, documentos ni datos personales en localStorage/sessionStorage. Guardar borrador persiste en servidor; cerrar sin guardar no conserva cambios nuevos. La cuenta estudiantil se crea solo al aprobar, nunca al abrir el formulario.

Aviso de correo de prueba cuando no hay Gmail ni transporte real configurado: esto no prueba entrega SMTP. Los pagos solo aparecen como «Próximamente»; no hay integración ni usuarios de acudiente.

## Formulario de convocatoria

### Idiomas y codificación

Las pantallas de ingreso, convocatorias, portal público, seguimiento estudiantil, conexión de correo y autorizaciones usan `react-intl` y los catálogos `es.json`/`en.json`, incluidos estados, ayudas, botones, accesibilidad, mensajes y etiquetas dinámicas. También se traducen el menú de ingreso, acceso desde login y el onboarding reducido del estudiante. Fechas/horas de seguimiento usan el locale activo; el selector nativo de fechas conserva el formato del navegador. Los nombres de convocatorias, grados, documentos, instrucciones y observaciones escritos por el colegio son datos y no se traducen automáticamente.

Se corrigió la codificación del catálogo inglés (por ejemplo `Communication`) y textos que aún estaban en español en sedes, usuarios, cuenta, estados, entidades y menús. El cliente envía `Accept-Language` con el idioma seleccionado, sin modificar cuerpos ni credenciales; la API de ingreso/correo traduce sus respuestas y errores. No cambia permisos ni almacenamiento de documentos.

Verificación de i18n: 47 pruebas frontend, compilación/presupuesto y lint dirigido. El recorrido con fixtures cambia ES → EN → ES y cubre configuración, revisión, portal, correo y solicitudes de plataforma, con escritorio/móvil. Pruebas estáticas detectan texto JSX sin traducir en los componentes nuevos, claves ausentes, ICU inválido y caracteres dañados en ambos catálogos. Capturas `ingreso-convocatoria-en-desktop.png`, `ingreso-convocatoria-en-mobile.png`, `ingreso-revision-en-desktop.png`, `ingreso-portal-en-mobile.png`, `correo-en-desktop.png` y `correo-solicitudes-en-desktop.png` en `artifacts/ui-smoke/` (datos ficticios).

Grados y cupos se presentan en dos columnas en escritorio y una en móvil. Los campos requeridos llevan asterisco: nombre, año, apertura, cierre cuando no se marca «Sin fecha de cierre», cupos de grados seleccionados, aviso de privacidad y nombre de cada dato adicional. Cada documento agregado exige nombre, descripción/instrucciones, tamaño máximo de 1 a 10 MB y al menos un formato permitido. Los nuevos documentos comienzan con PDF, JPG, PNG y DOCX desmarcados; editar no restablece los formatos guardados. La casilla «Obligatorio» determina si el aspirante debe entregar ese requisito, no si puede guardarse incompleto. Los controles de los datos adicionales quedan alineados horizontalmente y se adaptan al ancho disponible.

«Sin fecha de cierre» deshabilita el campo de cierre y envía `hasta: null`, persistido en servidor. Al desmarcarlo vuelve a exigirse una fecha igual o posterior a la apertura. No se reemplazan las fechas de convocatorias existentes automáticamente. «Permitir solicitudes por enlace» controla nuevas solicitudes y cargas/ediciones de borradores o correcciones: activado respeta la apertura y el cierre opcional; desactivado pausa esas acciones sin borrar expedientes ni impedir su consulta con correo y PIN. Sin cierre no hay vencimiento por calendario, pero se mantienen las restricciones del año lectivo (planificado/en curso), colegio, permisos y cupos. El resumen muestra «Sin fecha de cierre» en lugar de una fecha vacía.

Pruebas adicionales: el recorrido aislado guarda sin cierre, recarga, comprueba persistencia y vuelve a configurar un cierre. API: 21 pruebas de `EnrollmentIntakeTest` (306 aserciones), incluyendo pausa/reanudación, seguimiento, fechas inválidas, convocatoria futura/vencida y año cerrado. Requiere la migración tenant `2026_10_08_000004_allow_open_ended_enrollment_campaigns`.

Verificación del ajuste: 43 pruebas frontend, build/presupuesto y lint dirigido; recorrido con fixtures comprueba distribución, alineación, ausencia de desbordamiento, formatos iniciales y bloqueo de descripciones vacías o de solo espacios. Capturas `ingreso-configuracion-desktop.png`, `ingreso-configuracion-campos-desktop.png`, `ingreso-configuracion-grados-mobile.png` e `ingreso-configuracion-campos-mobile.png`. API: 19 pruebas de `EnrollmentIntakeTest` (272 aserciones), incluyendo rechazo de campos y requisitos incompletos al crear/editar. No se modificaron convocatorias reales para las pruebas.

## Conectar Gmail sin editar código

Menú de usuario → Ajustes institucionales → **Conexión de correo electrónico**, con icono de sobre. La pestaña y el título usan el mismo nombre en `/ajustes-institucionales/correo`; no se añade un acceso al menú global del colegio. Enlace, pestaña, ruta y acciones exigen `roles` con rector y permiso `config.correo`, fuera de plataforma/suplantación. Si la sesión incluye `role`, también debe ser rector. El permiso delegado por sí solo no da acceso. El servidor comprueba siempre rol principal rector, rol asignado y permiso en cada operación.

El alta inicial presenta al rector el formulario de remitente, nombre y contraseña de aplicación cuando la API permite editar. Incluye la guía de Google y sus enlaces oficiales. No es OAuth ni el vínculo Google del perfil. «Probar y guardar» espera la respuesta del servidor sobre la prueba al remitente; el navegador no comprueba entrega. La clave se vacía al enviar, no se recibe en GET ni se almacena en Query, localStorage o sessionStorage. Mantenerla vacía conserva la existente solo si no cambia la dirección.

Una conexión guardada muestra nombre y dirección como resumen de solo lectura. Para editar o desconectar, el rector solicita directamente autorización al superadministrador: selecciona la acción y escribe un motivo de 10 a 1000 caracteres. El diálogo advierte que no debe incluir claves. Una solicitud pendiente bloquea duplicados y muestra su estado después de actualizar o recargar la página.

La autorización es personal, de un solo uso y válida durante 24 horas. Los flags `puede_editar` y `puede_desconectar` de GET habilitan las acciones; el cliente nunca convierte un permiso delegado o un estado de solicitud en autorización. La UI cierra el formulario al vencer una autorización visible. Se muestran los estados pendiente, aprobada, rechazada, utilizada, vencida y obsoleta, junto con motivo, observación y fechas. Motivo y observación se renderizan como texto, sin interpretar HTML.

Desconectar exige su propia autorización y confirmación. El backend conserva el registro protegido sin secreto: `configurado: false` junto con `requiere_autorizacion: true` **no** es un alta inicial. Reconectar exige una nueva solicitud de edición aprobada. Ante un 403 se bloquea la acción y se vuelve a consultar; un error no borra el resumen ni afirma que la desconexión se completó. También se recuerda revocar la clave en Google.

Query `school-mail` separada por colegio, con reinicio del componente al cambiar contexto. Guardar o desconectar actualiza esa consulta e invalida solo `ingreso` del colegio. Crear solicitudes no recarga identidad, onboarding ni módulos académicos. Las pruebas usan exclusivamente fixtures; no utilizan, reemplazan ni prueban el Gmail real ya configurado.

## Autorización en plataforma

`/configuracion/correo-solicitudes` está disponible únicamente para superadmin de plataforma **sin colegio activo** (`isPlatform && !activeColegio`). Un componente React junto al Navbar muestra un sobre enlazado a esta página y el número real de pendientes de `GET /platform/correo-solicitudes/resumen`. Esa respuesta solo contiene el contador; no se modifica el HTML legado de notificaciones de demostración. Si falla la consulta, no se inventa un cero.

La bandeja consulta `GET /platform/correo-solicitudes?estado=pendiente&page=1` por defecto. Solo ofrece los filtros **Pendientes** (`pendiente`) y **Todas** (`todas`), además de paginar y actualizar. Presenta colegio, nombre del solicitante (string, sin correo), acción, motivo, observación y fechas. Aprobar requiere confirmación y acepta observación vacía o de 10 a 1000 caracteres; rechazar exige observación de 10 a 1000 caracteres. Campo y botón validan ambos límites. Ambos diálogos indican no incluir claves. La resolución usa `POST /platform/correo-solicitudes/{url_token}/resolver` con `decision` y observación opcional para aprobación.

Cada fila incluye `disponible`. Con `false` conserva su estado y visibilidad, muestra «Colegio temporalmente no disponible» y deshabilita aprobar/rechazar. Las demás filas siguen operativas. Un 503 al resolver muestra el error y actualiza la lista/contador sin afirmar que se resolvió ni ocultar otras solicitudes.

Lista y contador comparten la raíz Query `school-mail-requests`. Resolver invalida exclusivamente esa raíz. El tópico realtime `school-mail-requests` actualiza lista/contador en plataforma y la consulta `school-mail` en el colegio correspondiente, respetando la separación de ámbitos; no recarga identidad ni otras pantallas. Los endpoints, la vigencia y la propiedad de cada autorización siguen siendo responsabilidad del servidor.

## Pruebas

```sh
npm test
npm run build
npm run test:ui:ingreso
node scripts/browser-smoke.mjs --institutional
```

Los recorridos ejecutan Vite + fixtures de API y navegador Edge aislado, sin escribir en colegios reales. `scripts/enrollment-smoke.mjs` cubre alta inicial, resumen bloqueado, motivo mínimo, solicitud pendiente sin duplicados, recarga, aprobación, rechazo, observación como texto, grant consumido, vencimiento con pestaña abierta, 403, error de consulta sin falso borrado, permiso delegado, suplantación, enlace/badge, filtro `todas`, paginación y desconexión/reconexión protegida. Verifica que solicitar/resolver no recarga consultas ajenas y que la clave no persiste. Conserva el recorrido de convocatoria, revisión, correcciones, PIN, borrador, subida de archivo, reenvío, aprobación y asignación.

Capturas ignoradas, generadas con datos ficticios, bajo `artifacts/ui-smoke/`:

- `correo-institucional-inicial-desktop.png`: alta inicial.
- `correo-institucional-desktop.png`, `correo-institucional-mobile.png`: remitente guardado de solo lectura.
- `correo-solicitar-autorizacion.png`, `correo-institucional-pendiente.png`: solicitud del rector y espera de respuesta.
- `correo-institucional-autorizado.png`: formulario habilitado por autorización.
- `correo-institucional-desconectado.png`: conexión eliminada, reconexión todavía protegida.
- `correo-solicitudes-pendientes-desktop.png`, `correo-solicitudes-pendientes-mobile.png`: bandeja pendiente y badge real.
- `correo-resolver-autorizacion.png`: confirmación del superadmin.
- `correo-solicitudes-desktop.png`, `correo-solicitudes-mobile.png`: historial, rechazo y paginación.
- `correo-solicitudes-no-disponible.png`: colegios temporalmente no disponibles, con estado conservado y acciones bloqueadas; prueba de 503 incluida.
- `correo-solicitudes-disponibilidad-mixta.png`, `correo-solicitudes-error-503.png`: otra fila operativa junto al colegio no disponible, y rechazo de resolución con error 503.
- `institutional-menu-desktop.png`, `institutional-menu-mobile.png`: menú de usuario.
- `ingreso-*.png`: recorrido de matrícula conservado.

Corte frontend del 8 de octubre de 2026: 43 pruebas del cliente (incluye menús y realtime), build/presupuesto de bundle y lint dirigido de los componentes modificados. El recorrido de correo/ingreso pasó con fixtures; comprueba navegación desde el header entre las tres rutas, íconos distintos y ausencia de la barra duplicada, también tras recargar. Compara los estilos calculados de las tres cabeceras (radio, sombra, relleno, fuente y descripción) en escritorio y móvil; capturas `ingreso-*-estilo-*.png`. El recorrido institucional verifica la selección directa de zona horaria sin buscador de ciudad. La revisión visual cubre escritorio y móvil sin desbordamiento horizontal. API y migraciones se verifican por separado en backend; estas pruebas no acreditan envío real de correo ni despliegue VPS.

El responsable de backend confirmó el 8 de octubre la aceptación de una prueba SMTP real al remitente existente de Inmaculada, conservando su credencial. No se registran aquí direcciones ni claves; no hay credenciales pendientes de introducir para esa prueba. Esta verificación se reporta por separado del smoke frontend con fixtures. El despliegue en VPS continúa pendiente.

Operación del servidor, límites y correo: `colegio-saas-backend/docs/INGRESO_ESTUDIANTIL.md`. Fuente funcional: `documentacion-girgit/educativo-saas/Logica del negocio/04-procesos-academicos/matriculas.md`.
