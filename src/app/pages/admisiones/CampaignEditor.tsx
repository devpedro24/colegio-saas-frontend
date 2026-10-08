import {useIntl} from 'react-intl'
import {useState} from 'react'
import {Modal} from 'react-bootstrap'
import type {Campaign, Catalog, Requirement} from './ingreso.types'

export function CampaignEditor({catalog, initial, save, close, busy, error}: {catalog: Catalog; initial?: Campaign;
  save: (c: Campaign) => void; close: () => void; busy: boolean; error: string}) {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)

  const [form, setForm] = useState<Campaign>(initial ?? {nombre: '', ano_token: catalog.anos[0]?.token ?? '', abierta: false,
    desde: new Date().toLocaleDateString('en-CA'), hasta: '', configuracion: {grados: [], documentos: [], campos: [], privacidad: ''}})
  const cfg = form.configuracion
  const update = (changes: Partial<Campaign['configuracion']>) => setForm({...form, configuracion: {...cfg, ...changes}})
  const doc = (index: number, changes: Partial<Requirement>) => update({documentos: cfg.documentos.map((d,i) => i === index ? {...d, ...changes} : d)})
  return <Modal show onHide={() => !busy && close()} size='xl' centered scrollable dialogClassName='ingreso-modal'><Modal.Header closeButton closeLabel={t('intake.ui.close')}><Modal.Title>{initial ? t('intake.ui.configureEnrollmentRound') : t('intake.ui.newEnrollmentRound')}</Modal.Title></Modal.Header>
    <form onSubmit={e => {e.preventDefault(); save(form)}}><Modal.Body className='ingreso'>
      {error && <div className='alert alert-danger' role='alert'>{error}</div>}
      <p className='ingreso-help'>{t('intake.ui.requirementsAreLockedWhenTheFirstApplicationIsReceivedYouCanThen')}</p>
      <p className='ingreso-help'>{t('intake.ui.fieldsMarkedWithAreRequiredCompleteEveryDocumentRequirementOrAdditionalField')}</p>
      <div className='ingreso-grid'>
        <div><label htmlFor='campaign-name' className='required'>{t('intake.ui.name')}</label><input id='campaign-name' className='form-control' maxLength={120} required pattern='.*\S.*' value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></div>
        <div><label htmlFor='campaign-year' className='required'>{t('intake.ui.academicYear')}</label><select id='campaign-year' className='form-select' required value={form.ano_token} onChange={e => setForm({...form, ano_token: e.target.value, configuracion: {...cfg, grados: []}})}>
          {catalog.anos.map(y => <option key={y.token} value={y.token}>{y.nombre}</option>)}</select></div>
        <div><label htmlFor='campaign-start' className='required'>{t('intake.ui.opensOn')}</label><input id='campaign-start' type='date' required className='form-control' value={form.desde} onChange={e => setForm({...form, desde: e.target.value})} /></div>
        <div><label htmlFor='campaign-end' className={form.hasta === null ? '' : 'required'}>{t('intake.ui.closingDate')}</label><input id='campaign-end' type='date' required={form.hasta !== null} disabled={form.hasta === null} min={form.desde} className='form-control' value={form.hasta ?? ''} onChange={e => setForm({...form, hasta: e.target.value})} />
          <label className='form-check mt-3'><input id='campaign-no-end' type='checkbox' className='form-check-input' checked={form.hasta === null} onChange={e => setForm({...form, hasta: e.target.checked ? null : ''})} />{t('intake.ui.noClosingDate')}</label></div>
      </div>
      <div className='form-check form-switch mt-6 mb-3'><input id='campaign-open' type='checkbox' className='form-check-input' aria-describedby='campaign-open-help' checked={form.abierta} onChange={e => setForm({...form, abierta: e.target.checked})} /><label htmlFor='campaign-open'>{t('intake.ui.allowApplicationsThroughTheLink')}</label></div>
      <p id='campaign-open-help' className='ingreso-help'>{t(form.hasta === null ? 'intake.openLinkHelp' : 'intake.scheduledLinkHelp')}</p>
      <p className='ingreso-help mb-6'>{t('intake.ui.withNoClosingDateYouCanKeepTheLinkEnabledAndPause')}</p>
      <h3>{t('intake.ui.gradesAndTotalCapacity')}</h3><p className='ingreso-help'>{t('intake.ui.capacityIncludesActiveEnrollmentsAndApprovedApplicationsAwaitingAGroupForThat')}</p>
      <div className='ingreso-grid campaign-grades'>
      {catalog.grados.filter(g => g.ano_token === form.ano_token).map(g => {const selected = cfg.grados.find(x => x.token === g.token); return <div key={g.token} className='ingreso-row d-flex align-items-center justify-content-between gap-5'>
        <label className='form-check d-flex gap-3 mb-0'><input type='checkbox' className='form-check-input' checked={!!selected} onChange={e => update({grados: e.target.checked ? [...cfg.grados, {token: g.token, nombre: g.nombre, cupo: 30}] : cfg.grados.filter(x => x.token !== g.token)})} />{g.nombre}</label>
        {selected && <input aria-label={t('intake.capacityLabel', {grade: g.nombre})} type='number' min={1} max={10000} required className='form-control w-100px flex-shrink-0' value={selected.cupo} onChange={e => update({grados: cfg.grados.map(x => x.token === g.token ? {...x, cupo: Number(e.target.value)} : x)})} />}</div>})}
      </div>
      {!cfg.grados.length && <p className='ingreso-help mt-3'>{t('intake.ui.selectAtLeastOneGradeAndSetItsCapacityBeforeSaving')}</p>}
      <h3 className='mt-8'>{t('intake.ui.requiredDocuments')}</h3>
      {cfg.documentos.map((d,i) => <section key={d.key} className='ingreso-card'>
        <div className='ingreso-grid'><div><label htmlFor={`doc-name-${i}`} className='required'>{t('intake.ui.documentName')}</label><input id={`doc-name-${i}`} required pattern='.*\S.*' className='form-control' maxLength={120} value={d.nombre} onChange={e => doc(i, {nombre: e.target.value})} /></div>
          <div><label htmlFor={`doc-size-${i}`} className='required'>{t('intake.ui.maximumSizeMb')}</label><input id={`doc-size-${i}`} type='number' required min={1} max={10} className='form-control' value={d.max_mb} onChange={e => doc(i, {max_mb: Number(e.target.value)})} /></div></div>
        <label className='mt-4 required' htmlFor={`doc-help-${i}`}>{t('intake.ui.descriptionAndInstructions')}</label><textarea id={`doc-help-${i}`} required className='form-control' maxLength={1000} value={d.instrucciones ?? ''} onChange={e => {e.target.setCustomValidity(e.target.value.trim() ? '' : t('intake.ui.enterADescriptionForTheDocument')); doc(i, {instrucciones: e.target.value})}} />
        <div className='d-flex flex-wrap align-items-center gap-5 mt-4' role='group' aria-label={t('intake.formatsLabel', {number: i+1})} aria-describedby={`doc-formats-help-${i}`}>{['pdf','jpg','png','docx'].map(ext => <label key={ext} className='form-check'><input type='checkbox' className='form-check-input' checked={d.formatos.includes(ext)} onChange={e => doc(i, {formatos: e.target.checked ? [...d.formatos, ext] : d.formatos.filter(x => x !== ext)})} />{ext.toUpperCase()}</label>)}
          <label className='form-check'><input type='checkbox' className='form-check-input' checked={d.obligatorio} onChange={e => doc(i, {obligatorio: e.target.checked})} />{t('intake.ui.required')}</label></div>
        <p id={`doc-formats-help-${i}`} className='ingreso-help mt-3'>{t('intake.ui.selectAtLeastOneAllowedFormatForThisDocument')}</p>
        <p className='ingreso-help mt-4'>{t('intake.ui.applyToTheseGradesNoneSelectedMeansAll')}</p><div className='d-flex flex-wrap gap-5'>{cfg.grados.map(g => <label key={g.token} className='form-check'><input type='checkbox' className='form-check-input' checked={d.grados.includes(g.token)} onChange={e => doc(i, {grados: e.target.checked ? [...d.grados, g.token] : d.grados.filter(x => x !== g.token)})} />{g.nombre}</label>)}</div>
        <button type='button' className='btn btn-sm btn-light-danger mt-4' onClick={() => update({documentos: cfg.documentos.filter((_,n) => n !== i)})}>{t('intake.ui.removeRequirement')}</button>
      </section>)}
      <button type='button' className='btn btn-light-primary' disabled={cfg.documentos.length >= 30} onClick={() => update({documentos: [...cfg.documentos, {key: `doc_${crypto.randomUUID().replace(/-/g, '').slice(0,12)}`, nombre: '', instrucciones: '', obligatorio: true, formatos: [], max_mb: 5, grados: []}]})}>{t('intake.ui.document')}</button>
      <h3 className='mt-8'>{t('intake.ui.additionalInformation')}</h3><p className='ingreso-help'>{t('intake.ui.nameDateOfBirthAndIdentityDocumentAreAlreadyIncludedOnlyAdd')}</p>
      {cfg.campos.map((f,i) => <div className='ingreso-row ingreso-grid align-items-center' key={f.key}><div><label className='required' htmlFor={`field-name-${i}`}>{t('intake.ui.additionalFieldName')}</label><input id={`field-name-${i}`} aria-label={t('intake.fieldNameLabel', {number: i+1})} className='form-control' required pattern='.*\S.*' maxLength={120} value={f.nombre} onChange={e => update({campos: cfg.campos.map((x,n) => n === i ? {...x, nombre: e.target.value} : x)})} /></div>
        <div className='d-flex flex-wrap align-items-center gap-4 campaign-field-options'><select aria-label={t('intake.fieldTypeLabel', {number: i+1})} className='form-select w-auto' required value={f.tipo} onChange={e => update({campos: cfg.campos.map((x,n) => n === i ? {...x, tipo: e.target.value as 'texto' | 'fecha'} : x)})}><option value='texto'>{t('intake.ui.text')}</option><option value='fecha'>{t('intake.ui.date')}</option></select>
          <label className='form-check'><input type='checkbox' className='form-check-input' checked={f.obligatorio} onChange={e => update({campos: cfg.campos.map((x,n) => n === i ? {...x, obligatorio: e.target.checked} : x)})} />{t('intake.ui.required')}</label>
          <button type='button' className='btn btn-sm btn-light-danger' onClick={() => update({campos: cfg.campos.filter((_,n) => n !== i)})}>{t('intake.ui.remove')}</button></div></div>)}
      <button type='button' className='btn btn-light-primary mt-4' disabled={cfg.campos.length >= 20} onClick={() => update({campos: [...cfg.campos, {key: `campo_${crypto.randomUUID().replace(/-/g, '').slice(0,12)}`, nombre: '', tipo: 'texto', obligatorio: false}]})}>{t('intake.ui.field')}</button>
      <label className='mt-8 required' htmlFor='campaign-privacy'>{t('intake.ui.schoolPrivacyNoticeAndConsent')}</label><textarea id='campaign-privacy' rows={4} className='form-control' required minLength={20} maxLength={5000} value={cfg.privacidad} onChange={e => update({privacidad: e.target.value})} />
      <p className='ingreso-help mt-4'>{t('intake.ui.noFeesPaymentGatewayComingSoonNoGuardianAccountsAreCreated')}</p>
    </Modal.Body><Modal.Footer><button type='button' className='btn btn-light' disabled={busy} onClick={close}>{t('intake.ui.cancel')}</button><button className='btn btn-primary' disabled={busy || !cfg.grados.length || cfg.documentos.some(d => !d.formatos.length)}>{busy ? t('intake.ui.saving') : t('intake.ui.saveEnrollmentRound')}</button></Modal.Footer></form>
  </Modal>
}
