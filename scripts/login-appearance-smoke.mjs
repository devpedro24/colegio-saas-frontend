// Real rendering with an isolated headless browser and in-memory API.
// Node 20: node --experimental-websocket scripts/login-appearance-smoke.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const browserPath = process.env.SMOKE_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
assert.ok(fs.existsSync(browserPath), 'Set SMOKE_BROWSER_PATH to an installed Chromium browser executable.')
assert.ok(typeof WebSocket === 'function', 'Node 20 requires --experimental-websocket for this isolated smoke test.')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'girCampus-login-preview-'))
const artifacts = path.join(root, 'artifacts', 'login-appearance-smoke')
fs.mkdirSync(artifacts, {recursive: true})
const apiReads = [], apiWrites = [], errors = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const fixturePath = '/scripts/fixtures/login-appearance-preview.html'
let server, browser, socket, command, evaluate

try {
  server = await createServer({root, logLevel: 'error', server: {host: '127.0.0.1', port: 5199, strictPort: true}, plugins: [{
    name: 'isolated-login-appearance-api',
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        const url = new URL(request.url, 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()
        if (request.method === 'GET') apiReads.push(url.pathname)
        else apiWrites.push({method: request.method, path: url.pathname})
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        if (request.method === 'GET' && ['/api/platform/login-appearance', '/api/colegios/smoke-school/login-appearance'].includes(url.pathname)) {
          response.end(JSON.stringify({image_url: '/media/stock/600x400/img-9.jpg', version: 'a'.repeat(32), customized: true}))
          return
        }
        // Every unexpected endpoint is blocked here, never proxied to the actual API.
        response.statusCode = 401
        response.end(JSON.stringify({message: 'Unexpected endpoint in isolated presentation test.'}))
      })
    },
  }]})
  await server.listen()
  const origin = 'http://127.0.0.1:5199'
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1', 'about:blank'],
  {windowsHide: true, stdio: 'ignore'})
  const activePortFile = path.join(profile, 'DevToolsActivePort')
  for (let n = 0; n < 150 && !fs.existsSync(activePortFile); n++) await sleep(100)
  assert.ok(fs.existsSync(activePortFile), 'Isolated browser did not open its debugging endpoint.')
  const port = fs.readFileSync(activePortFile, 'utf8').split('\n')[0]
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await once(socket, 'open')
  let serial = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const callback = pending.get(message.id)
      if (callback) {
        pending.delete(message.id)
        message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result)
      }
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    }
  })
  command = (method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 30000)
    const id = ++serial
    pending.set(id, {
      resolve: result => {clearTimeout(timer); resolve(result)},
      reject: error => {clearTimeout(timer); reject(error)},
    })
    socket.send(JSON.stringify({id, method, params}))
  })
  evaluate = async expression => {
    const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result?.value
  }
  const until = async (expression, label = expression) => {
    for (let n = 0; n < 250; n++) {
      try {if (await evaluate(expression)) return} catch { /* Navigation can replace the execution context. */ }
      await sleep(100)
    }
    throw new Error(`UI condition timed out: ${label}`)
  }
  const screenshot = async name => {
    // Bootstrap animates modal/buttons; capture only after the visible state settles.
    await sleep(300)
    const capture = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false})
    fs.writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(capture.data, 'base64'))
  }
  const navigate = async query => {
    await command('Page.navigate', {url: `${origin}${fixturePath}?${query}`})
    await until(`!!(document.querySelector('[data-testid="login-visual-panel"]') || document.querySelector('input[type="file"]'))`, 'fixture ready')
  }
  const clickText = async text => {
    const clicked = await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===${JSON.stringify(text)});if(!button)return false;button.click();return true})()`)
    assert.ok(clicked, `Missing button: ${text}`)
  }
  const frameDocument = `document.querySelector('iframe[title="Vista previa del inicio de sesión"]')?.contentDocument`
  const coverGeometry = async (inFrame = false) => evaluate(`(()=>{
    const doc=${inFrame ? frameDocument : 'document'};
    const panel=doc?.querySelector('[data-testid="login-visual-panel"]');
    const image=doc?.querySelector('[data-testid="login-background-image"]');
    if(!panel||!image)return null;
    const p=panel.getBoundingClientRect(),i=image.getBoundingClientRect();
    return {panel:{x:p.x,y:p.y,width:p.width,height:p.height,right:p.right,bottom:p.bottom},
      image:{x:i.x,y:i.y,width:i.width,height:i.height,right:i.right,bottom:i.bottom},
      objectFit:doc.defaultView.getComputedStyle(image).objectFit,loaded:image.complete&&image.naturalWidth>0,
      src:image.getAttribute('src'),viewport:doc.defaultView.innerWidth,overflow:doc.documentElement.scrollWidth>doc.defaultView.innerWidth+1};
  })()`)
  const assertCover = geometry => {
    assert.ok(geometry?.loaded, `Image did not load: ${JSON.stringify(geometry)}`)
    assert.equal(geometry.objectFit, 'cover')
    for (const property of ['x', 'y', 'width', 'height', 'right', 'bottom']) {
      assert.ok(Math.abs(geometry.panel[property] - geometry.image[property]) <= 1,
        `Custom image does not cover panel ${property}: ${JSON.stringify(geometry)}`)
    }
    assert.equal(geometry.overflow, false, 'Login must not overflow horizontally.')
  }
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false})

  await navigate('mode=screen&scope=platform')
  await until(`document.querySelector('[data-testid="login-background-image"]')?.naturalWidth>0`)
  const desktop = await coverGeometry()
  assertCover(desktop)
  assert.ok(desktop.panel.width >= 700 && desktop.panel.height >= 890, JSON.stringify(desktop))
  assert.equal(await evaluate(`document.body.innerText.includes('Desarrollado por GirGit Software')`), true)
  await screenshot('login-custom-desktop')

  await navigate('mode=screen&scope=platform&image=default')
  assert.equal(await evaluate(`!!document.querySelector('[data-testid="login-background-image"]')`), false)
  await until(`!![...document.images].find(image=>image.src.includes('auth-screens.png')&&image.complete&&image.naturalWidth)`)
  await screenshot('login-default-desktop')

  await navigate('mode=card&scope=school')
  await until(`!!document.querySelector('input[type="file"]')`)
  const dom = await command('DOM.getDocument')
  const input = await command('DOM.querySelector', {nodeId: dom.root.nodeId, selector: 'input[type="file"]'})
  await command('DOM.setFileInputFiles', {nodeId: input.nodeId, files: [path.join(root, 'public/media/misc/auth-bg.png')]})
  await clickText('Previsualizar login')
  await until(`(()=>{const image=${frameDocument}?.querySelector('[data-testid="login-background-image"]');return image?.naturalWidth>0&&image.getAttribute('src')?.startsWith('blob:')})()`, 'candidate preview ready')
  const candidate = await coverGeometry(true)
  assertCover(candidate)
  assert.ok(candidate.src.startsWith('blob:'), `Preview must use the local candidate before upload: ${candidate.src}`)
  const schoolPreview = await evaluate(`${frameDocument}.body.innerText`)
  assert.ok(schoolPreview.includes('Inscripciones y matrículas'), 'School preview must include the school enrollment link.')
  assert.ok(!schoolPreview.includes('Desarrollado por GirGit Software'), 'School preview must not show platform-only copyright.')
  assert.deepEqual(apiWrites, [], 'Preview must not save a candidate or authenticate.')
  assert.ok(apiReads.every(read => read === '/api/colegios/smoke-school/login-appearance'), JSON.stringify(apiReads))
  await screenshot('login-preview-school-desktop')

  await clickText('Móvil')
  await until(`${frameDocument}?.defaultView.innerWidth<500`, 'mobile preview viewport')
  await until(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Móvil')?.getAttribute('aria-pressed')==='true'`, 'mobile preview selected')
  const mobilePreview = await coverGeometry(true)
  assertCover(mobilePreview)
  assert.ok(mobilePreview.panel.width <= 500, JSON.stringify(mobilePreview))
  await screenshot('login-preview-school-mobile')
  assert.deepEqual(apiWrites, [])
  await clickText('Cerrar vista previa')
  await until(`!document.querySelector('iframe[title="Vista previa del inicio de sesión"]')`, 'preview closed')
  assert.equal(await evaluate(`document.querySelector('input[type="file"]').files.length`), 1,
    'Closing the preview must keep the unsaved candidate in the settings form.')
  assert.deepEqual(apiWrites, [], 'Closing a preview must not save or authenticate.')

  await navigate('mode=card&scope=platform')
  await clickText('Previsualizar login')
  await until(`${frameDocument}?.querySelector('[data-testid="login-background-image"]')?.naturalWidth>0`, 'platform preview ready')
  const platformPreview = await evaluate(`${frameDocument}.body.innerText`)
  assert.ok(platformPreview.includes('Desarrollado por GirGit Software'))
  assert.ok(!platformPreview.includes('Inscripciones y matrículas'))
  await screenshot('login-preview-platform-desktop')
  assert.deepEqual(apiWrites, [], 'Opening and switching previews must never write.')
  assert.ok(apiReads.every(read => ['/api/colegios/smoke-school/login-appearance', '/api/platform/login-appearance'].includes(read)), JSON.stringify(apiReads))

  await command('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true})
  await navigate('mode=screen&scope=school')
  await until(`document.querySelector('[data-testid="login-background-image"]')?.naturalWidth>0`)
  assertCover(await coverGeometry())
  await screenshot('login-custom-mobile')
  assert.deepEqual(errors, [], 'Uncaught browser errors.')
  console.log('PASS: full-panel cover, default layout, local candidate preview without writes, platform/school context and mobile overflow.')
  console.log(`Screenshots: ${artifacts}`)
} catch (error) {
  if (command && socket?.readyState === WebSocket.OPEN) {
    try {
      const capture = await command('Page.captureScreenshot', {format: 'png'})
      fs.writeFileSync(path.join(artifacts, 'failure.png'), Buffer.from(capture.data, 'base64'))
      console.error('Page at failure:', await evaluate(`({url:location.href,text:document.body.innerText.slice(0,2000)})`))
    } catch { /* Preserve original failure. */ }
  }
  throw error
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({id: 999999, method: 'Browser.close'}))
    await sleep(250)
  }
  socket?.close()
  browser?.kill()
  await server?.close()
  // Remove only this run's disposable profile, never an installed browser profile.
  const temporaryRoot = path.resolve(os.tmpdir())
  const resolvedProfile = path.resolve(profile)
  const relativeProfile = path.relative(temporaryRoot, resolvedProfile)
  if (relativeProfile && !relativeProfile.startsWith('..') && !path.isAbsolute(relativeProfile)
    && path.basename(resolvedProfile).startsWith('girCampus-login-preview-')) {
    try {
      await fs.promises.rm(resolvedProfile, {recursive: true, force: true, maxRetries: 10, retryDelay: 200})
    } catch (error) {
      console.warn(`Temporary profile cleanup did not finish: ${error.message}`)
    }
  } else {
    console.warn('Refused profile cleanup outside the guarded temporary directory.')
  }
}
