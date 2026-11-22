// Real components, isolated browser profile and synthetic API; no real email or database.
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
assert.ok(typeof WebSocket === 'function', 'Use --experimental-websocket on Node 20.')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'girCampus-recovery-'))
const artifacts = path.join(root, 'artifacts', 'password-recovery-smoke')
fs.mkdirSync(artifacts, {recursive: true})
const writes = [], errors = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let server, browser, socket
let issued = 0
try {
  server = await createServer({root, logLevel:'error', server:{host:'127.0.0.1',port:5198,strictPort:true}, plugins:[{
    name:'isolated-recovery-api', configureServer(vite) {
      vite.middlewares.use((req,res,next) => {
        const url = new URL(req.url,'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()
        res.setHeader('Content-Type','application/json')
        res.setHeader('Cache-Control','no-store')
        if (req.method !== 'POST') {res.statusCode=401;res.end('{}');return}
        let body=''
        req.on('data',chunk => {body += chunk})
        req.on('end',() => {
          const data=JSON.parse(body)
          writes.push(url.pathname)
          if (data.email === 'throttle@example.test') {
            res.statusCode=429;res.setHeader('Retry-After','60');res.end(JSON.stringify({message:'Too many requests'}));return
          }
          if (url.pathname === '/api/forgot-password') {res.end(JSON.stringify({message:'Generic recovery message'}));return}
          if (url.pathname === '/api/forgot-password/otp') {
            issued++
            res.end(JSON.stringify({challenge:String(issued).padStart(24,'a'),expires_in:data.email==='expired@example.test'?2:600,resend_after:1}));return
          }
          if (url.pathname === '/api/reset-password/otp') {
            if (data.code !== (issued === 1 ? '123456':'654321') || data.challenge !== String(issued).padStart(24,'a')) {
              res.statusCode=422;res.end(JSON.stringify({message:'Código inválido',errors:{code:['Código de prueba incorrecto.']}}));return
            }
            res.end(JSON.stringify({message:'Password reset'}));return
          }
          if (url.pathname === '/api/reset-password') {
            assert.equal(data.token,'synthetic-link-token')
            assert.equal(data.password,data.password_confirmation)
            res.end(JSON.stringify({message:'Password reset'}));return
          }
          res.statusCode=401;res.end('{}')
        })
      })
    },
  }]})
  await server.listen()
  browser=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1','about:blank'],{windowsHide:true,stdio:'ignore'})
  const active=path.join(profile,'DevToolsActivePort')
  for(let n=0;n<150&&!fs.existsSync(active);n++) await sleep(100)
  assert.ok(fs.existsSync(active),'Isolated browser did not start.')
  const port=fs.readFileSync(active,'utf8').split('\n')[0]
  const targets=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()
  socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl)
  await once(socket,'open')
  let serial=0
  const pending=new Map()
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data)
    if(message.id) {const callback=pending.get(message.id);if(callback){pending.delete(message.id);message.error?callback.reject(new Error(JSON.stringify(message.error))):callback.resolve(message.result)}}
    if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text)
  })
  const command=(method,params={})=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('CDP timeout: '+method)),30000)
    const id=++serial
    pending.set(id,{resolve:result=>{clearTimeout(timer);resolve(result)},reject:error=>{clearTimeout(timer);reject(error)}})
    socket.send(JSON.stringify({id,method,params}))
  })
  const evaluate=async expression=>{
    const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text)
    return result.result?.value
  }
  const until=async expression=>{
    for(let n=0;n<300;n++){try{if(await evaluate(expression))return}catch{}await sleep(100)}
    throw new Error('UI timeout: '+expression)
  }
  const navigate=async query=>{
    await command('Page.navigate',{url:'http://127.0.0.1:5198/scripts/fixtures/password-recovery-preview.html'+(query||'')})
    await until(query?'!!document.querySelector("#new-password")':'!!document.querySelector("#recovery-email")')
  }
  const fill=async(selector,value)=>{
    await evaluate('document.querySelector('+JSON.stringify(selector)+').focus(); document.querySelector('+JSON.stringify(selector)+').select()')
    await command('Input.insertText',{text:value})
  }
  const click=async selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()')
  const screenshot=async name=>{
    await sleep(300)
    const metrics=await command('Page.getLayoutMetrics')
    const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}})
    fs.writeFileSync(path.join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'))
  }
  await command('Page.enable')
  await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
  await navigate()
  await fill('#recovery-email','rector@example.test')
  await click('#kt_password_reset_submit')
  await until('document.querySelector("[role=status]")?.textContent.includes("30 minutos")')
  assert.deepEqual(writes,['/api/forgot-password'])
  await screenshot('link-sent-desktop')
  await click('input[value=otp]')
  assert.equal(await evaluate('document.querySelector("#kt_password_reset_submit").disabled'),true,'Switching method must preserve the resend wait.')
  await navigate()
  await fill('#recovery-email','rector@example.test')
  await click('input[value=otp]')
  await click('#kt_password_reset_submit')
  await until('!!document.querySelector("#recovery-code")')
  await fill('#recovery-code','000000')
  await fill('#recovery-password','NewPassword!123')
  await fill('#recovery-confirm','NewPassword!123')
  await click('#kt_password_reset_submit')
  await until('document.querySelector("[role=alert]")?.textContent.includes("incorrecto")')
  await until('[...document.querySelectorAll("button")].some(button=>button.textContent.trim()==="Reenviar código"&&!button.disabled)')
  await evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent.trim()==="Reenviar código").click()')
  await until('document.querySelector("#recovery-code").value===""')
  await screenshot('otp-desktop')
  for (const width of [390,320]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true})
    await sleep(300)
    assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'Recovery must fit mobile.')
    await screenshot('otp-mobile-'+width)
  }
  await fill('#recovery-code','654321')
  await click('#kt_password_reset_submit')
  await until('document.querySelector("[role=status]")?.textContent.includes("sesiones anteriores")')
  assert.equal(await evaluate('!!document.querySelector("#recovery-code")'),false)
  await navigate('?reset=1')
  await fill('#new-password','LinkPassword!123')
  await fill('#confirm-password','LinkPassword!123')
  await click('form button.btn-primary')
  await until('document.querySelector(".alert-success")?.textContent.includes("sesiones anteriores")')
  await navigate()
  await fill('#recovery-email','expired@example.test')
  await click('input[value=otp]')
  await click('#kt_password_reset_submit')
  await until('document.body.innerText.includes("El código venció")')
  assert.equal(await evaluate('document.querySelector("#kt_password_reset_submit").disabled'),true)
  await navigate()
  await fill('#recovery-email','throttle@example.test')
  await click('#kt_password_reset_submit')
  await until('document.querySelector("[role=alert]")?.textContent.includes("Espera")')
  assert.deepEqual(errors,[])
  assert.ok(writes.includes('/api/reset-password')&&writes.includes('/api/reset-password/otp'))
  console.log('PASS: link and OTP, wrong code, resend, expiry, rate limit, mobile 320/390 and successful password changes. No real email sent.')
} finally {
  socket?.close()
  browser?.kill()
  await server?.close()
  const resolved=path.resolve(profile),relative=path.relative(path.resolve(os.tmpdir()),resolved)
  if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(resolved).startsWith('girCampus-recovery-')) {
    try {await fs.promises.rm(resolved,{recursive:true,force:true,maxRetries:10,retryDelay:200})}catch{}
  }
}
