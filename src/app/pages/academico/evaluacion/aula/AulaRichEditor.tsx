import {useRef, useState} from 'react'

const allowedTags = new Set(['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
  'blockquote', 'a', 'div', 'span', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'])
const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'svg', 'math', 'video', 'audio', 'img', 'template', 'noscript', 'base', 'link', 'meta'])
const allowedClasses = new Set(['aula-rich-banner', 'aula-rich-card', 'aula-rich-note', 'aula-rich-grid'])
function safePreview(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="aula-preview-root">${html}</div>`, 'text/html')
  const root = doc.getElementById('aula-preview-root')
  if (!root) return ''
  const clean = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) {if (node.nodeType !== Node.TEXT_NODE) node.parentNode?.removeChild(node); return}
    const element = node as HTMLElement
    const tag = element.tagName.toLowerCase()
    if (blockedTags.has(tag)) {element.remove(); return}
    Array.from(element.childNodes).forEach(clean)
    if (!allowedTags.has(tag)) {element.replaceWith(...Array.from(element.childNodes)); return}
    const href = tag === 'a' ? element.getAttribute('href') : null
    const classes = Array.from(element.classList).filter(name => allowedClasses.has(name))
    Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name))
    if (href && /^https?:\/\//i.test(href)) {
      element.setAttribute('href', href); element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer')
    }
    if (classes.length) element.className = classes.join(' ')
  }
  Array.from(root.childNodes).forEach(clean)
  return root.innerHTML
}

export function AulaRichEditor({initialHtml, onChange}: {initialHtml: string; onChange: (html: string) => void}) {
  const editor = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState(initialHtml)
  const [source, setSource] = useState(false)
  const sync = () => {const next = editor.current?.innerHTML ?? ''; setHtml(next); onChange(next)}
  const command = (name: string, value?: string) => {
    editor.current?.focus()
    document.execCommand(name, false, value)
    sync()
  }
  const insert = (markup: string) => command('insertHTML', markup)
  const link = () => {
    const url = window.prompt('Dirección del enlace (https://…)')?.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {window.alert('Usa una dirección http o https.'); return}
    command('createLink', url)
  }
  return <div className='aula-rich-editor'>
    <div className='aula-rich-toolbar' role='toolbar' aria-label='Formato del contenido'>
      <button type='button' onClick={() => command('formatBlock', 'h2')}>Título</button>
      <button type='button' onClick={() => command('formatBlock', 'p')}>Párrafo</button>
      <button type='button' aria-label='Negrita' onClick={() => command('bold')}><strong>B</strong></button>
      <button type='button' aria-label='Cursiva' onClick={() => command('italic')}><em>I</em></button>
      <button type='button' aria-label='Subrayado' onClick={() => command('underline')}><u>U</u></button>
      <button type='button' onClick={() => command('insertUnorderedList')}>• Lista</button>
      <button type='button' onClick={link}>↗ Enlace</button>
      <button type='button' onClick={() => insert('<div class="aula-rich-banner"><h2><br></h2><p><br></p></div>')}>Portada</button>
      <button type='button' onClick={() => insert('<div class="aula-rich-card"><h3><br></h3><p><br></p></div>')}>Tarjeta</button>
      <button type='button' onClick={() => insert('<div class="aula-rich-grid"><div class="aula-rich-card"><h3><br></h3><p><br></p></div><div class="aula-rich-card"><h3><br></h3><p><br></p></div></div>')}>Dos columnas</button>
      <button type='button' onClick={() => insert('<div class="aula-rich-note"><p><br></p></div>')}>Aviso</button>
      <button type='button' className='aula-rich-source-toggle' aria-pressed={source}
        onClick={() => {if (!source) sync(); else {const clean = safePreview(html); setHtml(clean); onChange(clean)}
          setSource(!source)}}>{source ? 'Visual' : 'HTML'}</button>
    </div>
    {source ? <textarea className='aula-rich-source' aria-label='Código HTML del contenido' value={html}
      onChange={event => {setHtml(event.target.value); onChange(event.target.value)}} />
      : <div ref={element => {editor.current = element; if (element && !element.dataset.ready) {
        element.innerHTML = html; element.dataset.ready = 'true'}}}
        className='aula-rich-canvas aula-rich-content' contentEditable suppressContentEditableWarning role='textbox'
        aria-label='Contenido del recurso' aria-multiline='true' onInput={sync}
        onPaste={event => {event.preventDefault(); document.execCommand('insertText', false,
          event.clipboardData.getData('text/plain')); sync()}} />}
    <p className='aula-rich-help'>Puedes combinar texto, enlaces, listas y diseños. El HTML se limpia al guardar;
      scripts y contenido incrustado externo no se publican.</p>
  </div>
}
