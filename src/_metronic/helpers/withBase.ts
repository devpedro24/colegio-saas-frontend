// El proyecto usa la base de Vite (import.meta.env.BASE_URL). Actualmente es "/" (raiz),
// por lo que "/media/..." queda igual; si se sirviera bajo un subpath (p.ej. "/app/"),
// withBase() antepondria esa base a las rutas de media del HTML que inyectamos con
// dangerouslySetInnerHTML (atributos src/href y url(...) inline) para no dar 404.
//
// Ademas repara hrefs rotos: al portar el HTML de demo46 se reemplazaron los enlaces
// muertos (".html") y quedaron como `href="` sin cerrar, que se "comen" el atributo
// siguiente (p.ej. `class="menu-link"`), dejando los <a> sin clase (se ven como link
// verde por defecto). Un `href="` seguido de espacio/salto O de `>` (cierre de etiqueta,
// que rompe toda la etiqueta) es SIEMPRE ese caso roto, asi que lo normalizamos a `href="#"`.
export function withBase(html: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return html
    .replace(/href="(?=[\s>])/g, 'href="#"')
    .replace(/="\/media\//g, `="${base}media/`)
    .replace(/url\((['"]?)\/media\//g, `url($1${base}media/`)
}
