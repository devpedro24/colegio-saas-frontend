import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const source = read('src/_metronic/i18n/language.ts')
function languageModule(globals = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText, {exports, ...globals})
  return exports
}
const language = languageModule()

test('language detection honors supported browser preferences and regional variants', () => {
  for (const [preferences, expected] of [
    [['es-CO', 'en-US'], 'es'], [['en-GB', 'es'], 'en'], [['fr-FR', 'es-MX', 'en'], 'es'],
    [['de-DE', 'en-US', 'es'], 'en'], [['pt-BR'], 'en'], [[], 'en'], [['ES_co'], 'es'],
  ]) assert.equal(language.resolveLanguage(null, preferences), expected)
})

test('a valid manual preference wins and malformed or unsupported settings cannot break i18n', () => {
  assert.equal(language.resolveLanguage({selectedLang: 'en'}, ['es-CO']), 'en')
  assert.equal(language.resolveLanguage({selectedLang: 'es'}, ['en-US']), 'es')
  for (const invalid of [null, {}, 'es', {selectedLang: 'fr'}, {selectedLang: 1}, {selectedLang: []}])
    assert.equal(language.resolveLanguage(invalid, ['es-CO']), 'es')
  for (const invalid of ['"broken', '{', 'undefined']) {
    const module = languageModule({window: {localStorage: {getItem: () => invalid}}})
    assert.equal(module.resolveLanguage(module.savedLanguage('i18nConfig'), ['es']), 'es')
  }
  const blocked = languageModule({window: {get localStorage() {throw new Error('Storage blocked')}}})
  assert.equal(blocked.resolveLanguage(blocked.savedLanguage('i18nConfig'), ['en']), 'en')
})

test('the actual document language follows the app while translation opt-out covers initial HTML and modals', () => {
  const element = () => ({attributes: {}, classes: new Set(), setAttribute(key, value) {this.attributes[key] = value},
    classList: {add(value) {this.owner.classes.add(value)}}})
  const html = element(), body = element(), loading = {textContent: 'Loading...'}
  html.classList.owner = html; body.classList.owner = body
  const module = languageModule({document: {documentElement: html, body, querySelector: () => loading}})
  module.applyDocumentLanguage('es')
  assert.equal(html.lang, 'es'); assert.equal(loading.textContent, 'Cargando…')
  for (const target of [html, body]) {
    assert.equal(target.attributes.translate, 'no'); assert(target.classes.has('notranslate'))
  }
  module.applyDocumentLanguage('en')
  assert.equal(html.lang, 'en'); assert.equal(loading.textContent, 'Loading…')
  const entry = read('index.html')
  assert.match(entry, /<html[^>]+translate="no"[^>]+notranslate/)
  assert.match(entry, /<body[^>]+notranslate[^>]+translate="no"/)
  assert.match(entry, /<meta name="google" content="notranslate"/)
})

test('manual language changes persist and notify the provider without reloading unfinished forms', () => {
  const stored = new Map(), dispatched = [], reloaded = []
  let storageAvailable = true
  const window = {dispatchEvent: event => dispatched.push(event), location: {reload: () => reloaded.push(true)}}
  const storage = {setItem: (key, value) => {if (!storageAvailable) throw new Error('Blocked'); stored.set(key, value)}}
  const module = {exports: {}}
  const provider = read('src/_metronic/i18n/Metronici18n.tsx').replace('import.meta.env.VITE_APP_I18N_CONFIG_KEY', 'undefined')
  const code = ts.transpileModule(provider, {compilerOptions: {module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}}).outputText
  const applied = []
  new Function('exports', 'require', 'window', 'localStorage', 'CustomEvent', code)(module.exports,
    name => name === './language' ? {...language, applyDocumentLanguage: value => applied.push(value)} : require(name),
    window, storage, class {constructor(type, options) {this.type = type; this.detail = options.detail}})
  module.exports.setLanguage('es')
  assert.equal(JSON.parse(stored.get('i18nConfig')).selectedLang, 'es')
  assert.deepEqual(applied, ['es']); assert.equal(dispatched[0].detail, 'es'); assert.equal(reloaded.length, 0)
  module.exports.setLanguage('fr')
  assert.equal(dispatched.length, 1)
  storageAvailable = false
  assert.doesNotThrow(() => module.exports.setLanguage('en'))
  assert.equal(dispatched.at(-1).detail, 'en'); assert.equal(reloaded.length, 0)
})
