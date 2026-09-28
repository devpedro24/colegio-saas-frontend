import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import {parse} from '@formatjs/icu-messageformat-parser'

const root = path.resolve(import.meta.dirname, '..')
const read = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
const catalogs = Object.fromEntries(['es', 'en'].map(lang => [lang, JSON.parse(read(path.join(root, 'src/_metronic/i18n/messages', lang + '.json')))]))
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.[jt]sx?$/.test(entry.name) ? [path.join(dir, entry.name)] : [])
const references = new Map()
const violations = []
const defaults = {}
const dynamic = new Set()
const catalogIssues = []
const placeholders = value => {
  const names = new Set()
  const visit = elements => {
    for (const element of elements) {
      if (element.type !== 0 && element.type !== 7) names.add(element.value)
      if (element.options) Object.values(element.options).forEach(option => visit(option.value))
      if (element.children) visit(element.children)
    }
  }
  visit(parse(value))
  return [...names].sort().join(',')
}
for (const key of new Set([...Object.keys(catalogs.es), ...Object.keys(catalogs.en)])) {
  if (!(key in catalogs.es) || !(key in catalogs.en)) catalogIssues.push(`Catalog parity: ${key}`)
  else {
    try { if (placeholders(catalogs.es[key]) !== placeholders(catalogs.en[key])) catalogIssues.push(`ICU arguments differ: ${key}`) }
    catch (error) { catalogIssues.push(`Invalid ICU: ${key}: ${error.message}`) }
  }
}
const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null
const add = (node, fallback, file) => {
  const id = literal(node)
  if (id === null) { if (node) dynamic.add(node.getText()); return }
  references.set(id, [...(references.get(id) ?? []), path.relative(root, file)])
  if (literal(fallback) !== null) defaults[id] ??= literal(fallback)
}
for (const file of walk(path.join(root, 'src'))) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['t', 'tv'].includes(node.expression.text)) {
      add(node.arguments[0], node.arguments[1], file)
      if (literal(node.arguments[1]) !== null) violations.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: literal fallback`)
    }
    if (ts.isObjectLiteralExpression(node)) {
      const id = node.properties.find(p => p.name?.getText() === 'id')
      const fallback = node.properties.find(p => p.name?.getText() === 'defaultMessage')
      if (id && (fallback || (ts.isCallExpression(node.parent) && node.parent.expression.getText().endsWith('formatMessage')))) add(id.initializer, fallback?.initializer, file)
      if (fallback) violations.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: defaultMessage`)
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText().endsWith('FormattedMessage')) {
        const id = node.attributes.properties.find(p => p.name?.getText() === 'id')
        const fallback = node.attributes.properties.find(p => p.name?.getText() === 'defaultMessage')
        add(id?.initializer, fallback?.initializer, file)
        if (fallback) violations.push(`${path.relative(root, file)}: JSX fallback`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const missing = Object.fromEntries(Object.entries(catalogs).map(([lang, messages]) => [lang, [...references.keys()].filter(key => !(key in messages)).map(key => ({key, fallback: defaults[key], files: references.get(key)}))]))
if (process.argv.includes('--json')) console.log(JSON.stringify({violations, missing, catalogIssues, defaults, dynamic: [...dynamic]}, null, 2))
else {
  console.log(`Checked ${references.size} static translation keys. Inline fallbacks: ${violations.length}.`)
  for (const [lang, keys] of Object.entries(missing)) console.log(`${lang}: ${keys.length} missing keys\n${keys.map(k => k.key).join('\n')}`)
  if (violations.length) console.log(violations.join('\n'))
  if (catalogIssues.length) console.log(catalogIssues.join('\n'))
}
if (violations.length || catalogIssues.length || Object.values(missing).some(keys => keys.length)) process.exitCode = 1
