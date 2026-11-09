// Derive selection from the URL, without storing account or tenant context in the browser.
export function syncSidebarRoute(menu: HTMLElement, pathname: string) {
  const route = pathname.replace(/^\/evaluacion\/planillas(?:\/.*)?$/, '/evaluacion/catalogo')
    .replace(/^\/evaluacion\/recuperaciones(?:\/.*)?$/, '/academico/boletines')
  const links = [...menu.querySelectorAll<HTMLElement>('[data-kt-nav]')]
  const selected = links.filter(link => {
    const path = link.dataset.ktNav!
    return route === path || route.startsWith(`${path}/`)
  }).sort((a, b) => b.dataset.ktNav!.length - a.dataset.ktNav!.length)[0]

  menu.querySelectorAll('.here').forEach(item => item.classList.remove('here'))
  links.forEach(link => {
    const active = link === selected
    link.classList.toggle('active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  let parent = selected?.parentElement
  while (parent && parent !== menu) {
    if (parent.classList.contains('menu-item')) {
      parent.classList.add('here')
      if (parent.hasAttribute('data-kt-menu-trigger')) {
        parent.classList.add('show')
        parent.querySelector(':scope > .menu-sub')?.classList.add('show')
      }
    }
    parent = parent.parentElement
  }
}
