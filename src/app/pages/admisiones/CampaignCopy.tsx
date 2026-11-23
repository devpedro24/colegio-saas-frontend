import {useState} from 'react'
import {useIntl} from 'react-intl'
import {CampaignEditor} from './CampaignEditor'
import type {Campaign, CampaignInput, Catalog, Choice} from './ingreso.types'

const sections = [
  ['grados', 'intake.ui.gradesAndTotalCapacity'],
  ['documentos', 'intake.renewal.copy.documentos'],
  ['campos', 'intake.ui.additionalInformation'],
] as const

export function CampaignCopy({source, catalog, save, close, busy}: {
  source: Campaign; catalog: Catalog; save: (form: CampaignInput) => void; close: () => void; busy: boolean
}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const sourceYear = source.ano_nombre ?? catalog.anos.find(year => year.token === source.ano_token)?.nombre
  const years = catalog.anos.filter(year => sourceYear && year.nombre >= sourceYear)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const nextYear = years.find(item => item.token !== source.ano_token)
  const [yearToken, setYearToken] = useState(nextYear?.token ?? '')
  const year = years.find(item => item.token === yearToken)
  const [selected, setSelected] = useState({grados: false, documentos: false, campos: false})
  const [draft, setDraft] = useState<Campaign>()
  const cfg = source.configuracion
  const required = new Set([
    ...(selected.grados ? cfg.grados.map(grade => grade.token) : []),
    ...(selected.documentos ? cfg.documentos.flatMap(doc => doc.grados) : []),
  ])
  const mapped = new Map<string, Choice>()
  const missing: string[] = []
  for (const token of required) {
    const original = catalog.grados.find(grade => grade.token === token)
    if (original?.ano_token === yearToken) {
      mapped.set(token, original)
      continue
    }
    const matches = catalog.grados.filter(grade => grade.ano_token === yearToken && grade.regla_token && grade.regla_token === original?.regla_token)
    if (matches.length === 1) mapped.set(token, matches[0])
    else missing.push(cfg.grados.find(grade => grade.token === token)?.nombre ?? t('intake.flow.grade'))
  }

  function prepareCopy() {
    if (!year || missing.length) return
    setDraft({
      nombre: `${source.nombre} — ${year.nombre}`, ano_token: year.token, abierta: false,
      desde: new Date().toLocaleDateString('en-CA'), hasta: null,
      configuracion: {
        privacidad: '', pin_expira_en: null,
        grados: selected.grados ? cfg.grados.map(grade => {
          const destination = mapped.get(grade.token)!
          return {token: destination.token, nombre: destination.nombre, cupo: grade.cupo}
        }) : [],
        campos: selected.campos ? cfg.campos : [],
        documentos: selected.documentos ? cfg.documentos.map(doc => ({...doc, grados: doc.grados.map(token => mapped.get(token)!.token)})) : [],
        documento_identidad: selected.documentos ? cfg.documento_identidad : null,
        verificar_identidad_automaticamente: selected.documentos && (cfg.verificar_identidad_automaticamente ?? true),
      },
    })
  }

  if (draft) return <CampaignEditor catalog={catalog} initial={draft} duplicate save={save} close={close} busy={busy} />
  return <div className='intake-next'><section className='intake-card'>
    <h1 className='fs-3'>{t('intake.renewal.copyRound')}</h1>
    <p className='intake-muted'>{source.nombre}</p>
    <label htmlFor='copy-year' className='form-label'>{t('intake.ui.academicYear')}</label>
    <select id='copy-year' className='form-select w-auto' disabled={!years.length} value={yearToken} onChange={e => setYearToken(e.target.value)}>
      <option value='' disabled>{t('intake.ui.select')}</option>
      {years.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
    </select>
    {!nextYear && !year && <p className='mt-3' role='status'>{t('intake.renewal.noFutureYear')}</p>}
    <fieldset className='my-6'>
      <legend className='fs-6 fw-semibold'>{t('intake.renewal.settingsToCopy')}</legend>
      {sections.map(([section, label]) => <label className='form-check mb-3' key={section}>
        <input id={`copy-${section}`} className='form-check-input' type='checkbox' checked={selected[section]}
          onChange={e => setSelected({...selected, [section]: e.target.checked})} />
        {t(label)}
      </label>)}
    </fieldset>
    {year && missing.length > 0 && <p className='alert alert-warning' role='alert'>{intl.formatMessage({id: 'intake.renewal.unmappedGrades'}, {grades: missing.join(', ')})}</p>}
    <div className='d-flex gap-3'>
      <button type='button' className='btn btn-light' onClick={close}>{t('intake.ui.cancel')}</button>
      <button type='button' id='prepare-copy' className='btn btn-primary' disabled={!year || !!missing.length} onClick={prepareCopy}>{t('intake.flow.continue')}</button>
    </div>
  </section></div>
}
