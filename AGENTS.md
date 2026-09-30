# Reglas para datos de la API en el navegador

- Los formularios y tipos nuevos consumen `slug`, `key` o `url_token`, nunca claves primarias o foráneas numéricas. Algunos componentes mantienen nombres locales como `id` o `*_id` para no reescribir la vista, pero esos valores son tokens públicos y el cliente API los traduce a `*_token` antes de enviar la petición.
- No guardar tokens de autenticación, IDs internos, datos personales ni contexto de suplantación en `localStorage` o `sessionStorage`. Solo preferencias como idioma, tema y tamaño de página pueden persistir allí.
- Usar el cliente HTTP compartido con cookies y cabecera CSRF para mutaciones; no reconstruir autenticación con `Authorization: Bearer` en componentes.
- Verificar navegación tras recarga, permisos y peticiones de un colegio distinto cuando se cambie un contrato de identidad pública.
