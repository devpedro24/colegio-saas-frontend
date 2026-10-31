// The backend holds the canonical engine; public/ is its browser distribution.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {fileURLToPath, pathToFileURL} from 'node:url'

const expectedFiles = ['font-catalog.js', 'model.js', 'proposal-model.js', 'layout-model.js', 'field-guide.js', 'page-layout.js', 'report-engine.js', 'canvas-engine.js']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export function verifyEngine(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'engine-manifest.json'), 'utf8'))
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '') || JSON.stringify(Object.keys(manifest.files || {}).sort()) !== JSON.stringify([...expectedFiles].sort())) {
    throw new Error('Invalid bulletin engine distribution manifest.')
  }
  for (const name of expectedFiles) {
    if (hash(fs.readFileSync(path.join(directory, name))) !== manifest.files[name]) throw new Error(`Bulletin engine changed without a release: ${name}`)
  }
  return manifest
}

function main() {
  const args = process.argv.slice(2)
  if (args.some((arg, i) => arg !== '--check' && arg !== '--source' && args[i - 1] !== '--source')) throw new Error('Usage: node scripts/sync-bulletin-engine.mjs [--check] [--source <directory>]')
  const explicit = args.indexOf('--source')
  if (explicit >= 0 && !args[explicit + 1]) throw new Error('Missing --source directory.')
  const target = fileURLToPath(new URL('../public/bulletin-editor/', import.meta.url))
  const source = explicit >= 0 ? path.resolve(args[explicit + 1]) : fileURLToPath(new URL('../../colegio-saas-backend/resources/bulletin-editor/', import.meta.url))
  const check = args.includes('--check')
  if (!check) {
    const release = verifyEngine(source)
    for (const name of [...expectedFiles, 'engine-manifest.json']) fs.copyFileSync(path.join(source, name), path.join(target, name))
    console.log(`Synchronized bulletin engine ${release.version}.`)
    return
  }
  const browser = verifyEngine(target)
  if (explicit >= 0 || fs.existsSync(source)) {
    const canonical = verifyEngine(source)
    if (JSON.stringify(browser) !== JSON.stringify(canonical)) throw new Error('Bulletin engine distributions differ. Run npm run sync:bulletin-engine, review and commit both releases.')
  }
  console.log(`Bulletin engine ${browser.version}: browser distribution verified.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main()
