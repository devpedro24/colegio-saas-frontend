const discarded = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'img', 'video',
  'audio', 'form', 'input', 'button', 'template', 'link', 'meta', 'noscript', 'base'])

/** The preview accepts the same small HTML dialect as the server and PDF. */
export function safeIndicatorHtml(value: string): string {
  const doc = new DOMParser().parseFromString(`<div id="indicator-preview-root">${value}</div>`, 'text/html')
  const root = doc.getElementById('indicator-preview-root')
  if (!root) return ''
  const output = doc.createElement('div')
  const append = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const lines = (node.textContent ?? '').replace(/\r\n?/g, '\n').split('\n')
      lines.forEach((line, index) => {
        if (index > 0) parent.appendChild(doc.createElement('br'))
        parent.appendChild(doc.createTextNode(line))
      })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()
    if (discarded.has(tag)) return
    if (tag === 'br') {parent.appendChild(doc.createElement('br')); return}
    const safeTag = ['b', 'strong'].includes(tag) ? 'strong'
      : ['i', 'em'].includes(tag) ? 'em'
        : ['p', 'div'].includes(tag) ? 'p'
          : ['u', 'ul', 'ol', 'li'].includes(tag) ? tag : null
    const wrapper = safeTag ? doc.createElement(safeTag) : parent
    Array.from(element.childNodes).forEach(child => append(child, wrapper))
    if (wrapper !== parent) parent.appendChild(wrapper)
  }
  Array.from(root.childNodes).forEach(node => append(node, output))
  return output.innerHTML
}
