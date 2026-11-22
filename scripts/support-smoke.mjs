import assert from 'node:assert/strict'

export function supportFixture(user) {
  let ticket=null
  const messages=[], calls=[]
  const token='s'.repeat(24)
  const middleware=(req,res,next)=>{
    const url=new URL(req.url,'http://localhost')
    const match=url.pathname.match(/^\/api\/(platform\/)?support\/tickets(?:\/([A-Za-z0-9]+))?(?:\/(messages|state))?$/)
    if(!match)return next()
    calls.push({method:req.method,path:url.pathname})
    res.setHeader('Content-Type','application/json')
    res.setHeader('Cache-Control','no-store')
    const send=data=>res.end(JSON.stringify(data))
    if(req.method==='GET') {
      if(!match[2]) {
        const list=ticket&&(!url.searchParams.get('status')||url.searchParams.get('status')===ticket.status)?[ticket]:[]
        return send({data:list,meta:{page:1,last_page:1,total:list.length}})
      }
      return send({data:ticket,messages,meta:{page:1,last_page:1,total:messages.length}})
    }
    let body=''
    req.on('data',chunk=>{body+=chunk})
    req.on('end',()=>{
      const data=JSON.parse(body)
      assert.ok(!Object.keys(data).some(key=>key==='id'||key.endsWith('_id')),'Support writes use public selectors.')
      if(req.method==='POST'&&!match[2]) {
        assert.match(data.request_key,/^[a-f0-9]{24}$/)
        if(!ticket) {
          ticket={token,reference:'GG-SMOKE001',school:'Colegio de prueba',origin:'Colegio de prueba',requester:user.name,
            subject:data.subject,category:data.category,status:'abierto',priority:true,version:1,
            created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
          messages.push({side:'colegio',author:user.name,body:data.body,created_at:ticket.created_at})
        }
        res.statusCode=201;return send({data:ticket})
      }
      if(match[3]==='messages') {
        assert.match(data.request_key,/^[a-f0-9]{24}$/)
        messages.push({side:match[1]?'plataforma':'colegio',author:user.name,body:data.body,created_at:new Date().toISOString()})
        ticket.version++
      }
      if(match[3]==='state') {assert.equal(data.version,ticket.version);ticket.status=data.status;ticket.version++}
      send({ok:true})
    })
  }
  return {middleware,calls,token,messages}
}

export async function runSupportSmoke({user,fixture,navigate,evaluate,until,command,screenshot,errors}) {
  const original={...user}
  const fill=async(selector,text)=>{
    await evaluate('document.querySelector('+JSON.stringify(selector)+').focus();document.querySelector('+JSON.stringify(selector)+').select()')
    await command('Input.insertText',{text})
  }
  const clickText=text=>evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent.trim()==='+JSON.stringify(text)+').click()')
  await navigate('/dashboard','Académico')
  assert.ok(await evaluate('document.querySelector("#kt_app_footer").innerText.includes("GirGit Software")&&!document.querySelector("#kt_app_footer").innerText.includes("Colegio SaaS")'))
  await evaluate('document.querySelector('+JSON.stringify('a[href="/soporte"]')+').click()')
  await until('location.pathname==="/soporte"&&document.body.innerText.includes("Tickets de mi colegio")')
  await clickText('Crear ticket')
  await until('!!document.querySelector("#ticket-subject")')
  await fill('#ticket-subject','No puedo guardar el boletín')
  await fill('#ticket-body','<img src=x onerror="window.supportXss=true"> El boletín no se guarda al continuar.')
  await evaluate('document.querySelector("#ticket-subject").closest("form").querySelector("button").click()')
  await until('location.pathname==="/soporte/'+fixture.token+'"&&!!document.querySelector("#support-reply")')
  assert.equal(await evaluate('window.supportXss'),undefined)
  assert.equal(await evaluate('document.querySelectorAll(".support-message img").length'),0)
  await fill('#support-reply','El problema ocurre al guardar el tercer período.')
  await evaluate('document.querySelector("#support-reply").closest("form").querySelector("button").click()')
  await until('document.querySelectorAll(".support-message").length===2')
  await screenshot('support-school-desktop',true)
  Object.assign(user,{is_platform:true,roles:['superadmin'],permissions:[],tenant_channel:null,name:'Equipo GirGit',email:'support@example.test'})
  await navigate('/soporte','Bandeja de soporte')
  await until('!!document.querySelector(".support-ticket")')
  await evaluate('document.querySelector(".support-ticket").click()')
  await until('!!document.querySelector("#support-state")')
  await fill('#support-reply','Revisamos el caso. Ya puedes intentar guardar de nuevo.')
  await evaluate('document.querySelector("#support-reply").closest("form").querySelector("button").click()')
  await until('document.querySelectorAll(".support-message").length===3')
  await evaluate('(()=>{const select=document.querySelector("#support-state");select.value="esperando_colegio";select.dispatchEvent(new Event("change",{bubbles:true}))})()')
  await clickText('Actualizar estado')
  await until('document.querySelector(".badge-light-warning")?.textContent==="Esperando al colegio"')
  await screenshot('support-platform-desktop',true)
  Object.assign(user,original)
  await navigate('/soporte/'+fixture.token,'Conversación')
  await until('!!document.querySelector("#support-reply")')
  assert.ok(await evaluate('document.body.innerText.includes("GirGit Software · Equipo GirGit")'))
  await clickText('Cerrar ticket')
  await until('document.body.innerText.includes("Este ticket está cerrado")')
  assert.equal(await evaluate('!!document.querySelector("#support-reply")'),false)
  await clickText('Reabrir ticket')
  await until('!!document.querySelector("#support-reply")')
  for(const width of [390,320]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true})
    await new Promise(resolve=>setTimeout(resolve,300))
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Support must fit mobile.')
    await screenshot('support-thread-mobile-'+width,true)
  }
  const reads=fixture.calls.filter(call=>call.method==='GET').length
  Object.assign(user,{roles:['estudiante'],permissions:[]})
  await navigate('/soporte','El rector o administrador del colegio')
  assert.equal(fixture.calls.filter(call=>call.method==='GET').length,reads,'Students must not query school support tickets.')
  assert.deepEqual(errors,[])
  console.log('PASS: GirGit footer, create ticket, school/team replies, state changes, close/reopen, literal HTML, role gating and mobile 320/390. No real tickets created.')
}
