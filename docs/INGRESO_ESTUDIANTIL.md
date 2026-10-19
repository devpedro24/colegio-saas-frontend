# Ingreso estudiantil

Administración en `/admisiones/solicitudes`, bajo el menú Ingreso estudiantil del header, sin barra de pestañas duplicada sobre el contenido. Conserva los accesos y permisos de Matrículas por enlace (documento), Admisiones «Próximamente» (persona con verificación) y Gestión de Matrículas académicas (libreta de registros), con íconos distintos. Portal público `/ingreso/:campaign?` accesible desde login del colegio, sin crear cuentas de acudiente.

## Pantallas

Gestión de Matrículas, Admisiones y Matrículas por enlace comparten `AcademicPageHeader` y las tarjetas del tema académico: mismo radio, sombra, tipografía y espaciado. La administración por enlace reutiliza `card-header`/`card-body`, selectores sólidos y tablas con separadores discontinuos. No se cambian los estilos independientes del portal público ni del correo institucional. El antiguo título «Admisiones y matrícula» pasa a «Gestión de Matrículas».

Las confirmaciones y errores administrativos usan el `ToastProvider` compartido (es/en), igual que años lectivos. La emisión y verificación del PIN en el portal público son la excepción deliberada: muestran progreso, error y confirmación persistente dentro de la tarjeta para no perder el siguiente paso en un toast. Los fallos de carga inicial y el aviso de correo no operativo permanecen visibles.

- Convocatorias: año, fechas, habilitación, vencimiento opcional de PIN (fecha y hora fija en la zona horaria del colegio, o «PIN sin vencimiento»), grados/cupos, requisitos comunes/por grado, campos adicionales y texto de privacidad. Esa opción puede editarse incluso si hay solicitudes; afecta a los PIN que se emitan después. Las convocatorias antiguas sin valor se interpretan y normalizan como «sin vencimiento», sin aviso de 15 minutos; la migración también conserva el PIN vigente ya enviado eliminando su fecha antigua.
- Bandeja paginada por estado: documentos/versiones, motivos, decisiones, propuesta de cambio de grado y grupos individuales/automáticos con confirmación.
- Portal: cada enlace opaco fija su convocatoria sin selector. La solicitud nueva es un flujo lineal sin pestañas: correo y grado → indicador de envío → confirmación en tarjeta → cuatro casillas del PIN → expediente. Se puede pegar el código completo o moverse con teclado. La petición deja un desafío privado HttpOnly en ese navegador; el correo también incluye un enlace privado para continuar en otro dispositivo. El PIN de cuatro dígitos nunca sirve solo: el servidor exige además el desafío o el secreto del enlace. Vence solo si la convocatoria fija una fecha y hora; siempre se bloquea después de cinco errores. Sin fecha de vencimiento, el desafío del navegador dura su sesión y el enlace privado del correo permite volver más tarde. `/ingreso` también muestra cuatro casillas. La opción y la API de códigos largos se retiraron. Tras consultar se conserva la sesión privada de dos horas para completar el formulario y consultar el seguimiento. Para reemitir un PIN con fecha ya vencida, el colegio primero debe ampliar esa fecha y el solicitante volver a pedirlo desde la convocatoria abierta.
- El fragmento antiguo `#codigo` no es un comprobante de envío: al abrir o recargar ese enlace se limpia y se muestra de nuevo el formulario de correo y grado. La pantalla de cuatro casillas aparece solo tras una respuesta exitosa del envío en la sesión actual o al abrir el enlace privado del correo. El servidor envía el PIN antes de responder con éxito; si el transporte rechaza el mensaje devuelve 503 y el portal mantiene el formulario con el error, sin afirmar que llegó. La aceptación por SMTP tampoco garantiza su llegada a la bandeja principal: revisar spam y la dirección escrita.
- En el enlace privado del correo no se muestra «Corregir correo o grado», porque esos datos ya están vinculados a la solicitud. El inicio de sesión institucional no ofrece acceso genérico a `/ingreso`, registro público ni Apple. La antigua ruta `/auth/registration` redirige a `/auth/login`; términos, planes y contacto permanecen sin cambios. Se conserva el acceso de Google tal como estaba.
- Dashboard estudiante aprobado sin grupo: aviso de asignación pendiente. Primer login exige solo contraseña, sin pasos institucionales.

El expediente público separa datos del estudiante, representante legal configurado y otros datos adicionales. Primer nombre, primer apellido, nacimiento, tipo/número de documento, celular y dirección son obligatorios para enviar; la edad se muestra al escoger nacimiento. Los teléfonos usan indicativo y solo dígitos; en Colombia se valida un celular de diez cifras que comienza por 3. Para el teléfono del representante se puede reutilizar el celular principal sin escribirlo dos veces. El parentesco se elige entre mamá, papá u otro (texto libre). Los documentos admiten reemplazo o retirada antes de su aprobación: retirar no borra el archivo ni sus versiones históricas, pero lo deja pendiente de nueva carga. El portal oculta el radicado interno y mantiene el mismo fondo en todo el desplazamiento. No hay botón para guardar borradores.

El portal marca su contenido con `lang` y `translate="no"` para impedir que el traductor automático del navegador convierta «Guardar» en «Ahorrar»; el idioma propio del SaaS sigue funcionando. La paleta usa violeta para jerarquía, Enviar a revisión (incluido hover de la misma familia), ámbar para pendientes, rojo para rechazos y verde para aprobaciones. El seguimiento público oculta los eventos rutinarios de carga o retirada de archivos; conserva las decisiones y observaciones de revisión, en especial rechazos que requieren corrección.

Datos del estudiante, representante legal y otros datos configurados comparten una sola tarjeta blanca; los pasos se distinguen por numeración y líneas internas, sin espacios de fondo entre ellos. Los selectores de parentesco alinean radio y texto con espacio constante; la opción «Usar el mismo celular» emplea una casilla circular verde con marca blanca. El botón «Guardar» está dentro de esa tarjeta, alineado a la derecha. El selector de indicativo usa banderas SVG locales del paquete MIT `flag-icons` (sin CDN), con país e indicativo visibles también en la lista y nombre regional localizado mediante `Intl.DisplayNames`. Su flecha es un KeenIcon de Metronic centrado, que apunta hacia arriba al desplegar la lista. El indicativo internacional «Otro país» permite entrada manual.

Toda acción se muestra según `ingreso.*`, pero el servidor vuelve a autorizar. `ingreso.ver` es requisito de las operaciones sobre expedientes. Secretaría y coordinación solo reciben acceso al habilitar sus permisos configurables. Capacidad comercial `academico`.

## Datos y comunicaciones

TanStack Query mantiene catálogo/listado en memoria con claves de colegio y campaña. Los avisos `enrollment-intake` invalidan solo consultas `ingreso`; no disparan recargas generales de onboarding/SIEE/horarios por cada documento. El cliente compartido conserva deduplicación de GET, CSRF y protección de contexto.

El portal usa cookies HttpOnly de desafío y sesión de matrícula y CSRF independiente; un 401 público no expulsa la sesión institucional del personal. El enlace privado usa fragmento URL para que su secreto no viaje en la petición de página y se retira de la barra tras verificar. No se almacenan PIN, enlaces privados, documentos ni datos personales en localStorage/sessionStorage. Los datos nuevos y archivos seleccionados permanecen solo en memoria hasta «Enviar a revisión»; recargar o cerrar pierde lo no enviado. La cuenta estudiantil se crea solo al aprobar, nunca al abrir el formulario.

Verificación visual del nuevo PIN: capturas `ingreso-pin-cuatro-casillas-{desktop,mobile}.png` e `ingreso-consulta-cuatro-casillas-{desktop,mobile}.png` bajo `artifacts/ui-smoke/`. La tarjeta blanca conserva el ancho del contenedor original en solicitud y consulta. El recorrido con datos ficticios comprueba ausencia de pestañas/toast de emisión, pegado/autorrelleno de cuatro dígitos, consulta con desafío del navegador y apertura del enlace privado incluso si había otra solicitud abierta en la misma pestaña. No se enviaron correos ni se crearon solicitudes reales durante este recorrido.

Aviso de correo de prueba cuando no hay Gmail ni transporte real configurado: esto no prueba entrega SMTP. Los pagos solo aparecen como «Próximamente»; no hay integración ni usuarios de acudiente.

## Formulario de convocatoria

Un cupo de grado vacío significa que el enlace no impone tope por grado; los límites del plan y de los grupos permanecen. La convocatoria puede seguir sin fecha de cierre, pero crear el enlace no obliga a publicarlo: el interruptor de publicación debe mantenerse apagado mientras el colegio revise los requisitos y el aviso de privacidad. Los nombres separados, nacimiento, tipo y número de documento ya están en el formulario base; los datos adicionales se configuran solo si hacen falta.

### Idiomas y codificación

Las pantallas de ingreso, convocatorias, portal público, seguimiento estudiantil, conexión de correo y autorizaciones usan `react-intl` y los catálogos `es.json`/`en.json`, incluidos estados, ayudas, botones, accesibilidad, mensajes y etiquetas dinámicas. También se traducen el menú de ingreso, acceso desde login y el onboarding reducido del estudiante. Fechas/horas de seguimiento usan el locale activo; el selector nativo de fechas conserva el formato del navegador. Los nombres de convocatorias, grados, documentos, instrucciones y observaciones escritos por el colegio son datos y no se traducen automáticamente.

Se corrigió la codificación del catálogo inglés (por ejemplo `Communication`) y textos que aún estaban en español en sedes, usuarios, cuenta, estados, entidades y menús. El cliente envía `Accept-Language` con el idioma seleccionado, sin modificar cuerpos ni credenciales; la API de ingreso/correo traduce sus respuestas y errores. No cambia permisos ni almacenamiento de documentos.

Verificación de i18n: 47 pruebas frontend, compilación/presupuesto y lint dirigido. El recorrido con fixtures cambia ES → EN → ES y cubre configuración, revisión, portal, correo y solicitudes de plataforma, con escritorio/móvil. Pruebas estáticas detectan texto JSX sin traducir en los componentes nuevos, claves ausentes, ICU inválido y caracteres dañados en ambos catálogos. Capturas `ingreso-convocatoria-en-desktop.png`, `ingreso-convocatoria-en-mobile.png`, `ingreso-revision-en-desktop.png`, `ingreso-portal-en-mobile.png`, `correo-en-desktop.png` y `correo-solicitudes-en-desktop.png` en `artifacts/ui-smoke/` (datos ficticios).

Grados y cupos se presentan en dos columnas en escritorio y una en móvil. Los campos requeridos llevan asterisco: nombre, año, apertura, cierre cuando no se marca «Sin fecha de cierre» y nombre de cada dato adicional. El cupo vacío no impone límite por grado; el aviso de privacidad se edita en la configuración institucional. Cada documento agregado exige nombre, descripción/instrucciones, tamaño máximo de 1 a 10 MB y al menos un formato permitido. Los nuevos documentos comienzan con PDF, JPG, PNG y DOCX desmarcados; editar no restablece los formatos guardados. La casilla «Obligatorio» determina si el aspirante debe entregar ese requisito, no si puede guardarse incompleto. Los controles de los datos adicionales quedan alineados horizontalmente y se adaptan al ancho disponible.

«Sin fecha de cierre» deshabilita el campo de cierre y envía `hasta: null`, persistido en servidor. Al desmarcarlo vuelve a exigirse una fecha igual o posterior a la apertura. No se reemplazan las fechas de convocatorias existentes automáticamente. «Permitir solicitudes por enlace» controla nuevas solicitudes y cargas/ediciones de borradores o correcciones: activado respeta la apertura y el cierre opcional; desactivado pausa esas acciones sin borrar expedientes ni impedir su consulta con enlace privado y PIN vigente. Sin cierre no hay vencimiento por calendario, pero se mantienen las restricciones del año lectivo (planificado/en curso), colegio, permisos y cupos. El resumen muestra «Sin fecha de cierre» en lugar de una fecha vacía.

La etiqueta de cada convocatoria, tanto en gestión como en el selector público, separa habilitación y vencimiento: interruptor apagado = «No publicada»; encendido y sin cierre = «Abierta · sin fecha de cierre»; encendido y con cierre = «Abierta · hasta [fecha]». Son etiquetas de configuración, no garantizan que se acepten solicitudes fuera de las fechas permitidas o si el año lectivo no está disponible. Cambiar la etiqueta no abre una convocatoria ni altera sus datos. También se muestran sus equivalentes en inglés.

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

Los recorridos ejecutan Vite + fixtures de API y navegador Edge aislado, sin escribir en colegios reales. `scripts/enrollment-smoke.mjs` cubre alta inicial, resumen bloqueado, motivo mínimo, solicitud pendiente sin duplicados, recarga, aprobación, rechazo, observación como texto, grant consumido, vencimiento con pestaña abierta, 403, error de consulta sin falso borrado, permiso delegado, suplantación, enlace/badge, filtro `todas`, paginación y desconexión/reconexión protegida. Verifica que solicitar/resolver no recarga consultas ajenas y que la clave no persiste. Conserva el recorrido de convocatoria, revisión, correcciones, PIN, selección local, envío único, reenvío, aprobación y asignación.

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

## Envío único — 10 de octubre de 2026

- Solo **Enviar a revisión**, dentro de la tarjeta blanca y alineado a la derecha. Asteriscos rojos; validación de requeridos, espacios, fechas, teléfonos, parentesco y dirección antes de iniciar la petición.
- `EnrollmentAddress` carga departamentos/municipios desde el catálogo local del backend, filtra municipios y vacía la selección al cambiar departamento. Colombia por defecto; domicilio extranjero con país/región/ciudad. No se envían datos a proveedores geográficos externos.
- Archivos como objetos `File` en estado React, sin IndexedDB, localStorage ni sessionStorage. Seleccionar/reemplazar/quitar no llama a la API. Se indica «Seleccionado · aún no enviado» y se avisa del riesgo de perder cambios al recargar.
- Un POST multipart envía datos, archivos, retiradas, consentimiento y UUID de reintento. Durante la petición se bloquean acciones; si falla, formulario y archivos permanecen seleccionados. El UUID solo se renueva tras éxito/cambio de solicitud.
- El backend comprueba formatos y campos, hace OCR local sobre la identidad y compara nombres/número/nacimiento. El navegador no sustituye esa comprobación. Ilegibilidad/discrepancias bloquean sin afirmar autenticidad.
- Convocatoria: requisito de identidad. Los rangos de edad y el aviso se administran ahora en la configuración institucional descrita debajo; la edad usa la fecha actual del colegio.
- Límite total y cantidad de archivos proceden de `limites_envio` del catálogo según PHP y aplicación; rechazo del exceso antes de cargar.
- ES/EN, compilación/presupuesto, lint dirigido y recorrido con fixtures; ninguna prueba de interfaz envía correos o crea estudiantes reales.

## Configuración permanente de matrículas — 14 de octubre de 2026

Menú de usuario → Ajustes institucionales → **Configuración de matrículas**, en `/ajustes-institucionales/matriculas`. La misma página está disponible en las pestañas institucionales y desde **Matrículas por enlace**. Los accesos y la ruta requieren `ingreso.configurar`; la API además exige la capacidad comercial `academico`. La sesión actual no expone un catálogo de capacidades del plan para duplicar esa comprobación en el navegador. No se infiere acceso por el nombre del plan.

No hay selector de año. Cada grado institucional usa `url_token`, nombre y nivel; el interruptor inicia sin valores inferidos. Activar exige mínimo y máximo enteros entre 1 y 120, ambos incluidos y ordenados. Desactivar envía ambos como `null`, sin restricción. El aviso exige de 20 a 5000 caracteres y rechaza espacios vacíos. Guardar está dentro de la tarjeta, a la derecha, y confirma con toast ES/EN.

`GET /ingreso/configuracion` entrega `{data:{version, requiere_revision, privacidad, zona_horaria, grados:[{url_token,nombre,nivel,edad_min,edad_max}]}}`. `PUT` envía solo `{version,privacidad,grados:[{url_token,edad_min,edad_max}]}`. La versión 0 representa una configuración aún no guardada globalmente. `requiere_revision` muestra ayuda sobre diferencias heredadas. Guardar aplica el aviso y los rangos a todas las convocatorias. Un 409 conserva los cambios visibles y bloquea un reintento ciego; «Cargar versión actual» avisa que reemplazará las ediciones locales y carga los datos vigentes para revisión.

El editor de convocatorias muestra un resumen de solo lectura y un enlace a la página institucional. No envía privacidad, rangos ni fechas de corte al guardar una convocatoria. Antes del primer guardado institucional conserva para el resumen la privacidad y los rangos efectivos de la convocatoria recibida; después usa las reglas institucionales. La API mantiene la compatibilidad con los datos heredados.

Los tokens de grado anual (`grado`) y regla institucional (`ingreso-grado`) son distintos. El catálogo de gestión aporta `grados[].regla_token`: el resumen resuelve primero el `token` anual de cada grado seleccionado y después usa su `regla_token` contra `configuracion.grados[].url_token`. No compara directamente ambos tokens ni usa nombres de grado para relacionarlos. Los niveles canónicos reutilizan las etiquetas ES/EN existentes `academico.nivel.*`; los nombres personalizados se conservan como datos.

La campaña presenta `zona_horaria`, `privacidad_version` y privacidad efectiva en `configuracion.privacidad`; sus grados incorporan `edad_min` y `edad_max`. El catálogo público aporta también `zona_horaria`. El portal calcula la edad con la fecha actual en esa zona, renueva la fecha cada 30 segundos y al recuperar foco/visibilidad, y calcula de nuevo al enviar. No hay fecha de corte editable. El snapshot opcional `validacion_edad:{nacimiento,grado_token,edad,fecha,edad_min,edad_max}` evita bloquear por edad actual cuando nacimiento y grado coinciden con la validación previa; cambiar cualquiera vuelve a validar contra el rango actual.

El único envío multipart añade `privacidad_version` del aviso mostrado. Un 422 con error `privacidad_version` retira el consentimiento y ofrece cargar/revisar el aviso vigente. Esa lectura actualiza la campaña sin aplicar de nuevo la solicitud, por lo que conserva datos, archivos seleccionados y retiradas locales. Se requiere aceptar otra vez. No se recarga la página ni se pierden archivos tras errores.

La consulta `['ingreso', colegio, 'configuracion']` se separa por colegio/contexto. El guardado actualiza su caché e invalida exclusivamente las otras consultas `ingreso` del mismo colegio; no recarga identidad, onboarding ni módulos ajenos. Usa el cliente HTTP compartido y CSRF. El componente se reinicia al cambiar de colegio.

Verificación añadida: pruebas de fechas en zonas distintas, cambio de año, cumpleaños y 29 de febrero, límites inclusivos y reutilización del snapshot solo para nacimiento/grado idénticos. El smoke con fixtures cubre guardado permanente, recarga, valores vacíos, privacidad vacía, rangos invertidos, 409, desactivación, permisos de ruta/menú, ES/EN, móvil/escritorio y aviso actualizado sin perder archivos. Pasaron 52/52 pruebas frontend, auditoría i18n sin claves faltantes, lint dirigido, compilación y presupuesto del bundle, y el recorrido completo `test:ui:ingreso`. Capturas `matriculas-institucionales-*.png` en `artifacts/ui-smoke/`, revisadas en escritorio/móvil. No se usa correo real ni se verifica el backend desde este recorrido.

Tras integrar `regla_token`, pasó el recorrido focalizado `node scripts/browser-smoke.mjs --ingreso-summary`: tokens anuales e institucionales diferentes, resumen de convocatorias nuevas/existentes, cambio de año compartiendo regla institucional, privacidad/rangos heredados con versión 0, niveles localizados y ES/EN. Este modo no realiza escrituras ni pruebas de correo. También pasaron `tsc --noEmit`, lint dirigido, las 7 pruebas de edad/i18n y la auditoría de traducciones. No se repitió el recorrido completo de correo para esta corrección.

### Repetición integral de QA — 14 de octubre de 2026

Tras la integración final se repitieron y aprobaron `npm test` (52/52), `npm run check:i18n` (1554 claves estáticas, ninguna faltante en ES/EN), `npm run build` (TypeScript, Vite y presupuestos), lint de `src/app/pages/admisiones`, `npm run test:ui:ingreso` completo y `node scripts/browser-smoke.mjs --ingreso-summary`. Se revisaron las capturas actualizadas de configuración institucional en escritorio y del formulario público en móvil.

El recorrido completo vuelve a cubrir correo institucional bloqueado/autorizado, permisos, configuración persistente, PIN privado, validación de requeridos, archivos locales hasta el envío, conservación del formulario tras errores, cambio de aviso con nuevo consentimiento, correcciones, aprobación, navegación y ES/EN. Las API del navegador son fixtures aisladas: este resultado no certifica SMTP, recepción en Gmail ni OCR de documentos reales. La suite del backend y la comprobación local de solo lectura se registran en su documento homónimo; las pruebas de campo con datos del colegio siguen siendo una etapa aparte.
