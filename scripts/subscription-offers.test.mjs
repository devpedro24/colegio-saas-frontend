import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import {createIntl} from 'react-intl'

const source = fs.readFileSync(new URL('../src/_metronic/layout/components/header/_UpgradeModalContent.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText
const {getUpgradeModalHtml, recommendOffer, requiresProposal} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const messages = locale => ({...JSON.parse(fs.readFileSync(new URL(`../src/_metronic/i18n/messages/${locale}.json`,import.meta.url),'utf8')),...JSON.parse(fs.readFileSync(new URL(`../src/_metronic/layout/components/header/upgrade.${locale}.json`,import.meta.url),'utf8'))})
const pricing = {student_monthly:1500, minimum_students:30, included_sites:1, additional_site_monthly:15000}
const quote = {students:45, sites:2, monthly_total:82350, discount_percent:10, discount_total:9150,
  addon_lines:[{key:'asistencia',total:9000}]}
const response = {data:[{key:'estandar',name:'Estándar',description:'<script>alert(1)</script>',features:['academico','simat'],pricing,storage_gb:2,quote},
  {key:'premium',name:'Premium',description:'Premium',features:['academico','asistencia'],pricing:{...pricing,student_monthly:2500,included_sites:3},storage_gb:5,quote:{...quote,monthly_total:112500}}],
  current:{key:'estandar',name:'Estándar',features:['academico','asistencia'],quote},
  catalog:{features:[{key:'academico',label:'plan.f.academico',description:'plan.f.academico.desc',available:true},
    {key:'asistencia',label:'plan.f.asistencia',description:'plan.f.asistencia.desc',available:true},
    {key:'simat',label:'plan.f.simat',description:'plan.f.simat.desc',available:false}]}}

for (const locale of ['es','en']) {
  const intl = createIntl({locale,messages:messages(locale)})
  test(`upgrade uses real contract totals, translated details and upcoming markers in ${locale}`,()=>{
    const html = getUpgradeModalHtml(intl,response,'estandar',false,false,false)
    assert.equal((html.match(/data-upgrade-select=/g)??[]).length,3)
    assert.ok(html.includes(intl.formatMessage({id:'upgrade.currentPlan'})))
    assert.ok(html.includes(intl.formatMessage({id:'plan.f.asistencia.desc'})))
    assert.ok(html.includes(intl.formatMessage({id:'upgrade.comingSoon'})))
    assert.ok(html.includes(intl.formatNumber(82350,{style:'currency',currency:'COP',maximumFractionDigits:0})))
    const annual = getUpgradeModalHtml(intl,response,'estandar',true,false,false)
    assert.ok(annual.includes(intl.formatNumber(988200,{style:'currency',currency:'COP',maximumFractionDigits:0})))
    assert.ok(!html.includes('<script>'))
    assert.ok(html.includes('&lt;script&gt;'))
    assert.ok(!html.includes('Startup'))
    assert.ok(!html.includes(intl.formatMessage({id:'upgrade.baseRate'})), 'The feature panel has no tariff breakdown.')
    assert.ok(html.includes('upgrade-features'), 'Long feature lists use their own scroll area.')
  })
}

test('recommendations follow site needs, contracted tools and quoted prices',()=>{
  const oneSite = {...response,current:null,data:response.data.map(plan=>({...plan,quote:{...plan.quote,sites:1}}))}
  assert.equal(recommendOffer(oneSite).key,'estandar')
  assert.equal(recommendOffer({...oneSite,data:oneSite.data.map(plan=>({...plan,quote:{...plan.quote,sites:2}}))}).key,'premium')
  assert.equal(recommendOffer({...oneSite,data:oneSite.data.map(plan=>({...plan,quote:{...plan.quote,sites:4}}))}).key,'premium')
  assert.equal(recommendOffer({...oneSite,current:{...response.current,customized:true}}).key,'custom')
  assert.equal(recommendOffer({...oneSite,data:oneSite.data.map(plan=>plan.key==='premium'?{...plan,quote:{...plan.quote,monthly_total:40000}}:plan)}).key,'premium')
})


test('comparison boundaries distinguish recommendation from requesting a proposal',()=>{
  const neutral = {...response,current:null}
  assert.equal(recommendOffer(neutral,{students:400,sites:1}).key,'estandar')
  assert.equal(recommendOffer(neutral,{students:401,sites:1}).key,'premium')
  assert.equal(requiresProposal(neutral,{students:1000,sites:5}),false)
  assert.equal(requiresProposal(neutral,{students:1001,sites:1}),true)
  assert.equal(requiresProposal(neutral,{students:30,sites:6}),true)
  const intl = createIntl({locale:'es',messages:messages('es')})
  const html = getUpgradeModalHtml(intl,neutral,'estandar',false,false,false,{students:1001,sites:1})
  assert.ok(html.includes('data-upgrade-proposal'))
  assert.ok(html.includes('Solicitar propuesta'))
  assert.ok(!html.includes('data-upgrade-total'))
  assert.ok(!html.includes('data-upgrade-select'))
  const custom = getUpgradeModalHtml(intl,response,'custom',false,false,false)
  assert.match(custom,/<button[^>]+class="upgrade-choice upgrade-custom-choice is-selected[^>]+data-upgrade-select="custom">/)
  assert.ok(custom.includes('upgrade-custom-art'))
  const updating = getUpgradeModalHtml(intl,neutral,'estandar',false,false,false,{students:60,sites:1})
  assert.ok(updating.includes('Calculando…'), 'Changed capacity must not display the previous quote as its price.')
  assert.ok(!updating.includes(intl.formatNumber(82350,{style:'currency',currency:'COP',maximumFractionDigits:0})))
})
