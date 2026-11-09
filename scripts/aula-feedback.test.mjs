import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const root='../src/app/pages/academico/evaluacion/aula/'
const read=file=>fs.readFileSync(new URL(root+file,import.meta.url),'utf8')
const es=JSON.parse(read('feedback.es.json')),en=JSON.parse(read('feedback.en.json'))
class ApiError extends Error {}
function evaluate(file,mocks){
  const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',js)(id=>{assert.ok(Object.hasOwn(mocks,id),id);return mocks[id]},module,module.exports)
  return module.exports
}
const events=[]
const feedback=locale=>evaluate('useAulaFeedback.ts',{
  'react-intl':{useIntl:()=>({locale})},'@/lib/api/client':{ApiError},
  '@/lib/ui/toast':{useToast:()=>({success:(...args)=>events.push(args),error:message=>events.push(message)})},
  './feedback.es.json':{default:es},'./feedback.en.json':{default:en},
})
test('Aula errors prefer the first nonempty field reason, preserving generic and unknown fallbacks',()=>{
  const {aulaErrorMessage}=feedback('es')
  const error=Object.assign(new ApiError('Datos inválidos'),{errors:{titulo:[''],contenido:['Revisa el contenido antes de guardar.']}})
  assert.equal(aulaErrorMessage(error,'No se pudo guardar.'),'Revisa el contenido antes de guardar.')
  assert.equal(aulaErrorMessage(new ApiError('Conflicto de versión'),'No se pudo guardar.'),'Conflicto de versión')
  assert.equal(aulaErrorMessage(new Error(''),'No se pudo guardar.'),'No se pudo guardar.')
  assert.equal(aulaErrorMessage(null,'No se pudo guardar.'),'No se pudo guardar.')
})
for(const locale of ['es','en'])test(`Aula ${locale} feedback supports created, updated and deleted operations`,()=>{
  events.length=0
  const f=feedback(locale).useAulaFeedback(),copy=locale==='es'?es:en
  assert.deepEqual(Object.keys(es).sort(),Object.keys(en).sort())
  f.success('resourceCreated','success');f.success('sectionSaved');f.success('resourceDeleted','deleted')
  assert.deepEqual(events,[[copy.resourceCreated,'success'],[copy.sectionSaved,'updated'],[copy.resourceDeleted,'deleted']])
})
test('only explicit answer saves request an action record; autosave and navigation omit it',async()=>{
  const calls=[]
  const {useGuardarRespuestas}=evaluate('aula.api.ts',{
    '@tanstack/react-query':{useMutation:options=>options,useQuery(){},useQueryClient:()=>({})},
    '@/lib/api/client':{api:{put:(path,body)=>{calls.push({path,body});return Promise.resolve({})}}},
    '@/lib/realtime':{shouldRefreshQuery:()=>false},
  })
  const hook=useGuardarRespuestas(),input={token:'x'.repeat(24),respuestas:{['q'.repeat(24)]:'Respuesta de prueba'}}
  await hook.mutationFn(input);await hook.mutationFn({...input,manual:false});await hook.mutationFn({...input,manual:true})
  assert.deepEqual(calls.map(row=>row.body.registrar_accion),[undefined,undefined,true])
  assert.ok(calls.every(row=>row.path===`/aula/intentos/${input.token}/respuestas?opaque=1`))
  assert.deepEqual(calls.map(row=>row.body.respuestas),[input.respuestas,input.respuestas,input.respuestas])
})
