# Entregas del frontend hasta el 30 de septiembre de 2026

Este registro resume los flujos trabajados en `pedro-dev`. La matriz de aceptación del producto se mantiene en `documentacion-girgit`; el contrato de seguridad del servidor está en `colegio-saas-backend/docs/SEGURIDAD_API.md`.

| Área | Estado de la interfaz |
|---|---|
| Acceso y bienvenida | Inicio de sesión y cambio obligatorio de contraseña temporal; pasos de logo e información institucional antes de continuar. Logo con encuadre y proporción elegidos por el usuario. |
| Menú y perfil | Identidad y plan reales en el menú, accesos previos conservados, ajustes institucionales en un panel secundario, perfil editable y MFA opcional con QR, clave manual y códigos de recuperación. |
| Navegación | Rutas de ajustes institucionales separadas de `/academico`; navegación de módulos y estado de pestañas tras recarga. |
| Año y estructura | Vistas de años, períodos, sedes, jornadas, niveles, grados, grupos, bloques y espacios. Apertura y cierre manual visibles solo con permisos efectivos. |
| Plan y horarios | Áreas, materias, asignación y horarios. El Rector selecciona grupo antes de cargar clases; el filtro permanece en la URL y la tabla usa el desplazamiento vertical de la página. |
| SIEE y evaluación | Currículo por grado con materias del nivel pertinente, área determinada por materia, edición del peso y separación visual entre alta y filtros; planillas, matrículas y filtros de evaluación. |
| Catálogos | Paginación desde servidor: hasta 20 registros se muestran completos sin controles; para más de 20, tamaño inicial 20 y opciones 5, 10, 20, 50, 100 y 1000. Se conserva la preferencia de tamaño. |
| Tiempo real | Reverb actualiza datos activos después de cambios, mantiene filtros y recupera información tras reconexión. |
| Seguridad | El navegador usa cookies HttpOnly y CSRF, limpia el almacenamiento heredado de autenticación y envía `slug`, `key` o token público de 24 caracteres; no envía claves primarias numéricas en el contrato académico público. |

Los nombres internos de algunos campos de componentes aún dicen `id` o `*_id`; en esas vistas representan tokens públicos y el cliente API los transforma al contrato de red. No se deben interpretar como claves de la base de datos. Las preferencias de idioma, tema y tamaño de página sí pueden quedar en almacenamiento local.

## Verificación y operación

En el corte de seguridad se completaron 20 pruebas frontend, comprobación TypeScript, compilación Vite y recorridos de navegador de navegación, paginación y ajustes. En producción se requieren HTTPS, origen autorizado, Reverb supervisado y la configuración de seguridad descrita por el backend. Los detalles pendientes y el alcance exacto están en la matriz de aceptación del repositorio de documentación.

## Rendimiento del 30 de septiembre

Las lecturas GET simultáneas se deduplican por URL, sesión y contexto, sin persistir datos personales. El bootstrap `/me` incluye onboarding para evitar una segunda petición del colegio; una validación de sesión por F5 sigue siendo intencional. Reverb no recarga todo al suscribirse inicialmente, conserva la recuperación al reconectar y comunica el socket de origen en las escrituras para evitar su propio eco.

Las pantallas académicas se cargan por ruta y se retiró el registro global no utilizado de Chart.js. El build verifica presupuestos comprimidos de JS/CSS. Se completaron 24 pruebas frontend, build y comprobaciones de navegador para arranque/F5, tiempo real y navegación académica con acciones de horarios en escritorio y móvil. `npm.cmd run test:ui:performance` comprueba un `/me` y cero `/onboarding/status` cuando el bootstrap está disponible; `npm.cmd run test:ui:realtime` necesita Reverb local.

Esto reduce trabajo innecesario, pero no certifica miles de usuarios: la capacidad HTTP y WebSocket debe medirse sobre staging con el perfil de producción documentado en el backend.

## Caché de navegación académica e invalidación (segunda revisión, 30 de septiembre)

Se corrigieron causas distintas de la deduplicación simultánea: caducidad de 30 segundos al remontar una vista, tabla y selector de áreas cargados por separado, doble consulta de asignaciones/horarios, descarga de catálogos al pasar el cursor y recargas repetidas por el hook de guardado más la notificación local.

- Años, estructura, plan de estudios, horarios, SIEE, parámetros y opciones académicas usan caché en memoria con invalidación por cambios. Las entradas inactivas se liberan después de 30 minutos; la sesión y el cambio de colegio limpian toda la caché. No se persiste información privada en localStorage/sessionStorage ni se cambia el `no-store` HTTP.
- El año y los filtros forman parte de las claves. Una tabla completa y sin filtros puede alimentar un selector; una búsqueda o página parcial nunca se considera un catálogo completo. Los selectores grandes mantienen carga paginada al abrirse, no al pasar el mouse.
- Asignación docente usa una sola respuesta para filas, paginación y catálogos. Horarios no hace una carga previa de catálogo para volver a pedir el mismo grupo. El cambio de contexto paginado empieza directamente en página 1.
- La invalidación registra cuándo comenzó cada lectura. Si el hook ya inició la recarga después de guardar, la notificación local no la repite; una lectura anterior que termina tarde sí queda invalidada. `/asignaciones` se clasifica como `schedule` en ambos repositorios, sin invalidar años ni `/me` por defecto. Los catálogos `academic-options*` sí reciben sus invalidaciones.
- Se conservan cambios remotos y reconexión. Como respaldo, con Reverb desconectado se recuperan vistas visibles cada 60 segundos; con conexión hay reconciliación cada 15 minutos ante posibles notificaciones perdidas. No hay consultas de respaldo en una pestaña oculta o sin red; al volver se comprueba si corresponde recuperar. Por tanto no se promete cero consultas para siempre.
- El estado de copia de un año sigue comprobándose al abrir su modal: no es un catálogo inmutable. Permisos, sesión, errores y validaciones del servidor siguen vigentes.

`npm.cmd run test:ui:cache` navega usando enlaces y pestañas reales de React, sin recargar el documento, registra ruta **y parámetros** y supera el antiguo vencimiento de 30 segundos con reloj controlado. Resultados con API de prueba aislada:

| Acción | GET comprobados |
|---|---:|
| Cargar años y recorrer Estructura → SIEE → Plan | 1 de años en todo el recorrido |
| Abrir Áreas y materias | 1 de áreas y 1 de materias |
| Abrir Asignación docente | 1 de horarios; 0 de catálogos académicos adicionales |
| Seleccionar grupo en Horarios | 1 de horarios |
| Volver a vistas ya cargadas sin cambios | 0 |
| Pasar el cursor sobre un selector | 0 |
| Guardar un área | 1 recarga de áreas y 1 de materias; 0 de años |

Las pruebas de Reverb verifican una sola lectura ante un cambio remoto del horario, conservación de filtros, actualización de años/permisos, recuperación sin socket y reconexión. Las pruebas unitarias cubren carreras entre lecturas y escrituras, invalidación, aislamiento por año/filtros y limpieza de contexto. F5 es una carga nueva: se valida la sesión y se vuelven a cargar los datos necesarios, sin guardar respuestas privadas en disco.

La revisión de lint de los archivos de esta corrección pasa. El lint global tiene incidencias preexistentes en formularios, dashboard, usuarios y otros archivos; no se debe confundir con una validación global exitosa. Estas pruebas miden solicitudes y comportamiento, no capacidad del VPS ni latencia con 1.000 usuarios.

Verificación de esta segunda revisión: 29 pruebas frontend y 12 pruebas backend de tiempo real (53 aserciones), TypeScript/build y presupuesto de transferencia, más recorridos de navegador de caché SPA, arranque/F5, Reverb, paginación y acciones académicas/escritorio/móvil. Los filtros vacíos y búsquedas con espacios se normalizan: quitar un filtro vuelve a usar la entrada sin filtro, sin descargarla otra vez si sigue vigente. No se hicieron commits, pushes, migraciones ni modificaciones de datos reales en esta revisión.
