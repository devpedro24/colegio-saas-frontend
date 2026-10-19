import {useIntl} from 'react-intl'
import {useState} from 'react'
import {Modal} from 'react-bootstrap'
import {Link} from 'react-router-dom'
import type {Campaign, CampaignInput, Catalog, Requirement} from './ingreso.types'
import {enrollmentSettingsPath, useEnrollmentSettings} from './enrollmentSettings.api'

function copyForYear(source: Campaign, year: string, catalog: Catalog): Campaign['configuracion'] {
  const target = (token: string) => {
    const identity = catalog.grados.find(g => g.token === token)?.regla_token
    const matches = catalog.grados.filter(g => g.ano_token === year && g.regla_token && g.regla_token === identity)
    return matches.length === 1 ? matches[0] : undefined
  }
  return {...source.configuracion, pin_expira_en: null,
    grados: source.configuracion.grados.flatMap(g => {const match = target(g.token); return match ? [{...g, token: match.token, nombre: match.nombre}] : []}),
    documentos: source.configuracion.documentos.map(d => ({...d, grados: d.grados.map(token => target(token)?.token ?? token)}))}
}

export function CampaignEditor({catalog, initial, duplicate = false, save, close, busy}: {catalog: Catalog; initial?: Campaign; duplicate?: boolean;
  save: (c: CampaignInput) => void; close: () => void; busy: boolean}) {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const settings = useEnrollmentSettings()

  const sourceYearName = catalog.anos.find(y => y.token === initial?.ano_token)?.nombre ?? ''
  const futureYears = catalog.anos.filter(y => y.nombre > sourceYearName).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const destination = futureYears[0]
  const [form, setForm] = useState<Campaign>(initial && duplicate ? {...initial, url_token: undefined, nombre: `${initial.nombre} — ${destination?.nombre ?? ''}`,
    ano_token: destination?.token ?? '', abierta: false, desde: new Date().toLocaleDateString('en-CA'), hasta: null,
    configuracion: copyForYear(initial, destination?.token ?? '', catalog)}
    : initial ? {...initial, configuracion: {...initial.configuracion, pin_expira_en: initial.configuracion.pin_expira_en || null}}
    : {nombre: '', ano_token: catalog.anos[0]?.token ?? '', abierta: false,
      desde: new Date().toLocaleDateString('en-CA'), hasta: '', configuracion: {grados: [], documentos: [], campos: [], privacidad: '', pin_expira_en: null}})
  const cfg = form.configuracion
  const institutional = settings.data?.data
  const privacy = institutional && institutional.version > 0 ? institutional.privacidad : initial?.configuracion.privacidad || institutional?.privacidad
  const update = (changes: Partial<Campaign['configuracion']>) => setForm({...form, configuracion: {...cfg, ...changes}})
  const doc = (index: number, changes: Partial<Requirement>) => update({documentos: cfg.documentos.map((d,i) => i === index ? {...d, ...changes} : d)})
  const unmapped = duplicate && initial ? initial.configuracion.grados.filter(g => !catalog.grados.some(target =>
    target.ano_token === form.ano_token && target.regla_token && target.regla_token === catalog.grados.find(source => source.token === g.token)?.regla_token)) : []
  return <Modal show onHide={() => !busy && close()} size='xl' centered scrollable dialogClassName='ingreso-modal'><Modal.Header closeButton closeLabel={t('intake.ui.close')}><Modal.Title>{duplicate ? t('intake.renewal.copyRound') : initial ? t('intake.ui.configureEnrollmentRound') : t('intake.ui.newEnrollmentRound')}</Modal.Title></Modal.Header>
    <form onSubmit={e => {e.preventDefault(); save({url_token: form.url_token, nombre: form.nombre, ano_token: form.ano_token, abierta: form.abierta, desde: form.desde, hasta: form.hasta,
      configuracion: {pin_expira_en: cfg.pin_expira_en, documento_identidad: cfg.documento_identidad, documentos: cfg.documentos, campos: cfg.campos,
        grados: cfg.grados.map(({token, nombre, cupo}) => ({token, nombre, cupo}))}})}}><Modal.Body className='ingreso'>
      <p className='ingreso-help'>{t('intake.ui.requirementsAreLockedWhenTheFirstApplicationIsReceivedYouCanThen')}</p>
      <p className='ingreso-help'>{t('intake.ui.fieldsMarkedWithAreRequiredCompleteEveryDocumentRequirementOrAdditionalField')}</p>
      <div className='ingreso-grid'>
        <div><label htmlFor='campaign-name' className='required'>{t('intake.ui.name')}</label><input id='campaign-name' className='form-control' maxLength={120} required pattern='.*\S.*' value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></div>
        <div><label htmlFor='campaign-year' className='required'>{t('intake.ui.academicYear')}</label><select id='campaign-year' className='form-select' required value={form.ano_token} onChange={e => setForm({...form, ano_token: e.target.value, configuracion: duplicate && initial ? copyForYear(initial, e.target.value, catalog) : {...cfg, grados: []}})}>
          {(duplicate ? futureYears : catalog.anos).map(y => <option key={y.token} value={y.token}>{y.nombre}</option>)}</select></div>
        <div><label htmlFor='campaign-start' className='required'>{t('intake.ui.opensOn')}</label><input id='campaign-start' type='date' required className='form-control' value={form.desde} onChange={e => setForm({...form, desde: e.target.value})} /></div>
        <div><label htmlFor='campaign-end' className={form.hasta === null ? '' : 'required'}>{t('intake.ui.closingDate')}</label><input id='campaign-end' type='date' required={form.hasta !== null} disabled={form.hasta === null} min={form.desde} className='form-control' value={form.hasta ?? ''} onChange={e => setForm({...form, hasta: e.target.value})} />
          <label className='form-check mt-3'><input id='campaign-no-end' type='checkbox' className='form-check-input' checked={form.hasta === null} onChange={e => setForm({...form, hasta: e.target.checked ? null : ''})} />{t('intake.ui.noClosingDate')}</label></div>
        <div><label htmlFor='campaign-pin-expiry' className={cfg.pin_expira_en === null ? '' : 'required'}>{t('intake.ui.pinExpiryDateTime')}</label>
          <input id='campaign-pin-expiry' type='datetime-local' required={cfg.pin_expira_en !== null} disabled={cfg.pin_expira_en === null} className='form-control' value={cfg.pin_expira_en ?? ''} onChange={e => update({pin_expira_en: e.target.value})} />
          <label className='form-check mt-3'><input id='campaign-pin-no-expiry' type='checkbox' className='form-check-input' checked={cfg.pin_expira_en === null} onChange={e => update({pin_expira_en: e.target.checked ? null : ''})} />{t('intake.ui.pinNoExpiry')}</label>
          <p className='ingreso-help mt-2'>{t(cfg.pin_expira_en === null ? 'intake.ui.pinNoExpiryHelp' : 'intake.ui.pinExpiryHelp', {timezone: catalog.zona_horaria ?? 'America/Bogota'})}</p></div>
      </div>
      {unmapped.length > 0 && <p className='alert alert-warning mt-4' role='alert'>{t('intake.renewal.unmappedGrades', {grades: unmapped.map(g => g.nombre).join(', ')})}</p>}
      <div className='form-check form-switch mt-6 mb-3'><input id='campaign-open' type='checkbox' className='form-check-input' aria-describedby='campaign-open-help' checked={form.abierta} onChange={e => setForm({...form, abierta: e.target.checked})} /><label htmlFor='campaign-open'>{t('intake.ui.allowApplicationsThroughTheLink')}</label></div>
      <p id='campaign-open-help' className='ingreso-help'>{t(form.hasta === null ? 'intake.openLinkHelp' : 'intake.scheduledLinkHelp')}</p>
      <p className='ingreso-help mb-6'>{t('intake.ui.withNoClosingDateYouCanKeepTheLinkEnabledAndPause')}</p>
      <h3>{t('intake.ui.gradesAndTotalCapacity')}</h3><p className='ingreso-help'>{t('intake.ui.capacityIncludesActiveEnrollmentsAndApprovedApplicationsAwaitingAGroupForThat')}</p>
      <div className='ingreso-grid campaign-grades'>
      {catalog.grados.filter(g => g.ano_token === form.ano_token).map(g => {const selected = cfg.grados.find(x => x.token === g.token); return <div key={g.token} className='ingreso-row d-flex align-items-center justify-content-between gap-5'>
        <label className='form-check d-flex gap-3 mb-0'><input type='checkbox' className='form-check-input' checked={!!selected} onChange={e => update({grados: e.target.checked ? [...cfg.grados, {token: g.token, nombre: g.nombre, cupo: null}] : cfg.grados.filter(x => x.token !== g.token)})} />{g.nombre}</label>
        {selected && <input aria-label={t('intake.capacityLabel', {grade: g.nombre})} type='number' min={1} max={10000} className='form-control w-100px flex-shrink-0' placeholder={t('intake.unlimitedCapacity')} value={selected.cupo ?? ''} onChange={e => update({grados: cfg.grados.map(x => x.token === g.token ? {...x, cupo: e.target.value === '' ? null : Number(e.target.value)} : x)})} />}</div>})}
      </div>
      {!cfg.grados.length && <p className='ingreso-help mt-3'>{t('intake.ui.selectAtLeastOneGradeAndSetItsCapacityBeforeSaving')}</p>}
      <section className='ingreso-row mt-8' aria-labelledby='campaign-institutional-summary'>
        <div className='d-flex flex-wrap align-items-center justify-content-between gap-3'><h3 id='campaign-institutional-summary'>{t('intake.settings.title')}</h3>
          <Link to={enrollmentSettingsPath} className='btn btn-sm btn-light-primary'><i className='ki-solid ki-setting-2 fs-4' aria-hidden='true' />{t('intake.settings.open')}</Link></div>
        <p className='ingreso-help'>{t('intake.settings.campaignHelp')}</p>
        {settings.isPending && <p role='status'>{t('intake.settings.loading')}</p>}
        {settings.error && <p className='text-danger' role='alert'>{settings.error.message}</p>}
        {cfg.grados.map(g => {const ruleToken = catalog.grados.find(x => x.token === g.token)?.regla_token
          const rule = institutional && institutional.version > 0 ? institutional.grados.find(x => x.url_token === ruleToken) : g
          return <p key={g.token}><strong>{g.nombre}</strong>{': '}{rule?.edad_min != null && rule.edad_max != null ? t('intake.settings.range', {min: rule.edad_min, max: rule.edad_max}) : t('intake.settings.unrestricted')}</p>})}
        <h4 className='fs-6 mt-5'>{t('intake.ui.schoolPrivacyNoticeAndConsent')}</h4>
        <p className='text-break' style={{whiteSpace: 'pre-wrap'}}>{privacy || t('intake.settings.privacyMissing')}</p>
      </section>
      <h3 className='mt-8'>{t('intake.ui.requiredDocuments')}</h3>
      {cfg.documentos.map((d,i) => <section key={d.key} className='ingreso-card'>
        <div><label htmlFor={`doc-name-${i}`} className='required'>{t('intake.ui.documentName')}</label><input id={`doc-name-${i}`} required pattern='.*\S.*' className='form-control' maxLength={120} value={d.nombre} onChange={e => doc(i, {nombre: e.target.value})} /></div>
        <label className='mt-4 required' htmlFor={`doc-help-${i}`}>{t('intake.ui.descriptionAndInstructions')}</label><textarea id={`doc-help-${i}`} required className='form-control' maxLength={1000} value={d.instrucciones ?? ''} onChange={e => {e.target.setCustomValidity(e.target.value.trim() ? '' : t('intake.ui.enterADescriptionForTheDocument')); doc(i, {instrucciones: e.target.value})}} />
        <div className='d-flex flex-wrap align-items-center gap-5 mt-4' role='group' aria-label={t('intake.formatsLabel', {number: i+1})} aria-describedby={`doc-formats-help-${i}`}>{['pdf','jpg','png','docx'].map(ext => <label key={ext} className='form-check'><input type='checkbox' className='form-check-input' checked={d.formatos.includes(ext)} onChange={e => doc(i, {formatos: e.target.checked ? [...d.formatos, ext] : d.formatos.filter(x => x !== ext)})} />{ext.toUpperCase()}</label>)}
          <label className='form-check'><input type='checkbox' className='form-check-input' checked={d.obligatorio} onChange={e => doc(i, {obligatorio: e.target.checked})} />{t('intake.ui.required')}</label></div>
        <p id={`doc-formats-help-${i}`} className='ingreso-help mt-3'>{t('intake.ui.selectAtLeastOneAllowedFormatForThisDocument')}</p>
        <p className='ingreso-help mt-4'>{t('intake.ui.applyToTheseGradesNoneSelectedMeansAll')}</p><div className='d-flex flex-wrap gap-5'>{cfg.grados.map(g => <label key={g.token} className='form-check'><input type='checkbox' className='form-check-input' checked={d.grados.includes(g.token)} onChange={e => doc(i, {grados: e.target.checked ? [...d.grados, g.token] : d.grados.filter(x => x !== g.token)})} />{g.nombre}</label>)}</div>
        <button type='button' className='btn btn-sm btn-light-danger mt-4' onClick={() => update({documentos: cfg.documentos.filter((_,n) => n !== i)})}>{t('intake.ui.removeRequirement')}</button>
      </section>)}
      <button type='button' className='btn btn-light-primary' disabled={cfg.documentos.length >= 30} onClick={() => update({documentos: [...cfg.documentos, {key: `doc_${crypto.randomUUID().replace(/-/g, '').slice(0,12)}`, nombre: '', instrucciones: '', obligatorio: true, formatos: [], grados: []}]})}>{t('intake.ui.document')}</button>
      <h3 className='mt-8'>{t('intake.ui.additionalInformation')}</h3><p className='ingreso-help'>{t('intake.ui.nameDateOfBirthAndIdentityDocumentAreAlreadyIncludedOnlyAdd')}</p>
      <label htmlFor='campaign-identity' className='required'>{t('intake.validation.identityRequirement')}</label><select id='campaign-identity' className='form-select mb-4' required value={cfg.documento_identidad ?? cfg.documentos.find(d => /identidad|identifica|identity/i.test(d.key + ' ' + d.nombre))?.key ?? ''} onChange={e => update({documento_identidad: e.target.value})}><option value=''>{t('intake.ui.select')}</option>{cfg.documentos.filter(d => d.obligatorio && !d.grados.length && !d.formatos.includes('docx')).map(d => <option key={d.key} value={d.key}>{d.nombre}</option>)}</select><p className='ingreso-help'>{t('intake.validation.identityHelp')}</p>
      {cfg.campos.map((f,i) => <div className='ingreso-row ingreso-grid align-items-center' key={f.key}><div><label className='required' htmlFor={`field-name-${i}`}>{t('intake.ui.additionalFieldName')}</label><input id={`field-name-${i}`} aria-label={t('intake.fieldNameLabel', {number: i+1})} className='form-control' required pattern='.*\S.*' maxLength={120} value={f.nombre} onChange={e => update({campos: cfg.campos.map((x,n) => n === i ? {...x, nombre: e.target.value} : x)})} /></div>
        <div className='d-flex flex-wrap align-items-center gap-4 campaign-field-options'><select aria-label={t('intake.fieldTypeLabel', {number: i+1})} className='form-select w-auto' required value={f.tipo} onChange={e => update({campos: cfg.campos.map((x,n) => n === i ? {...x, tipo: e.target.value as 'texto' | 'fecha'} : x)})}><option value='texto'>{t('intake.ui.text')}</option><option value='fecha'>{t('intake.ui.date')}</option></select>
          <label className='form-check'><input type='checkbox' className='form-check-input' checked={f.obligatorio} onChange={e => update({campos: cfg.campos.map((x,n) => n === i ? {...x, obligatorio: e.target.checked} : x)})} />{t('intake.ui.required')}</label>
          <button type='button' className='btn btn-sm btn-light-danger' onClick={() => update({campos: cfg.campos.filter((_,n) => n !== i)})}>{t('intake.ui.remove')}</button></div></div>)}
      <button type='button' className='btn btn-light-primary mt-4' disabled={cfg.campos.length >= 20} onClick={() => update({campos: [...cfg.campos, {key: `campo_${crypto.randomUUID().replace(/-/g, '').slice(0,12)}`, nombre: '', tipo: 'texto', obligatorio: false}]})}>{t('intake.ui.field')}</button>
      <p className='ingreso-help mt-4'>{t('intake.ui.noFeesPaymentGatewayComingSoonNoGuardianAccountsAreCreated')}</p>
    </Modal.Body><Modal.Footer><button type='button' className='btn btn-light' disabled={busy} onClick={close}>{t('intake.ui.cancel')}</button><button className='btn btn-primary' disabled={busy || !form.ano_token || !!unmapped.length || !cfg.grados.length || cfg.documentos.some(d => !d.formatos.length)}>{busy ? t('intake.ui.saving') : t('intake.ui.saveEnrollmentRound')}</button></Modal.Footer></form>
  </Modal>
}
