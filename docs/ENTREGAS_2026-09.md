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
