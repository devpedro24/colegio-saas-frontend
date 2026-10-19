import {useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {KTIcon} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'
import {useAuth} from '@/app/modules/auth'
import {useOnboarding} from '@/app/modules/onboarding/onboarding.api'
import {TemplateLivePreview} from './components/TemplateLivePreview'
import {useTemplateActions, useTemplateCatalog, type SavedTemplate, type TemplateDesign,
  type TemplateInput, type TemplateScope, type TemplateSectionKey} from './plantillas.api'
import './plantillas.css'

const palette = ['#183C67', '#0E695B', '#693E98', '#923E4F', '#9A5C17', '#252C39']
const fonts: TemplateDesign['font'][] = ['sans', 'serif', 'rounded']

export default function PlantillasPage() {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {currentUser} = useAuth()
  const branding = useOnboarding(currentUser?.tenant_channel, !currentUser?.is_platform)
  const [page, setPage] = useState(1)
  const catalog = useTemplateCatalog(page)
  const {create, save, publish} = useTemplateActions()
  const [selected, setSelected] = useState('base:periodo')
  const [name, setName] = useState('')
  const [scope, setScope] = useState<TemplateScope>('periodo')
  const [design, setDesign] = useState<TemplateDesign | null>(null)
  const [version, setVersion] = useState(0)
  const [baseline, setBaseline] = useState('')
  const [localItem, setLocalItem] = useState<SavedTemplate | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const templates = catalog.data?.plantillas ?? []
  const current = (localItem?.token === selected ? localItem : undefined) ?? templates.find(item => item.token === selected)
  const input: TemplateInput | null = design ? {nombre: name.trim(), ambito: scope, configuracion: design} : null
  const dirty = !!input && JSON.stringify(input) !== baseline
  const canEdit = !!catalog.data?.puede_editar
  const busy = create.isPending || save.isPending || publish.isPending
  const school = branding.data?.institution?.nombre || catalog.data?.colegio || ''
  const activeLabel = current?.revision_publicada ? `${t('templates.published')} · ${current.revision_publicada}` : t('templates.draft')

  const choose = (key: string, initial = false): boolean => {
    if (!catalog.data) return false
    if (!initial && dirty && !window.confirm(t('templates.discardConfirm'))) return false
    if (key.startsWith('base:')) {
      const nextScope = key.slice(5) as TemplateScope
      const next = structuredClone(catalog.data.base[nextScope])
      const nextName = t(nextScope === 'final' ? 'templates.defaultFinalName' : 'templates.defaultPeriodName')
      setSelected(key); setName(nextName); setScope(nextScope); setDesign(next); setVersion(0)
      setLocalItem(null)
      setBaseline(JSON.stringify({nombre: nextName, ambito: nextScope, configuracion: next}))
    } else {
      const next = catalog.data.plantillas.find(item => item.token === key)
      if (!next) return false
      setSelected(key); setName(next.nombre); setScope(next.ambito); setDesign(structuredClone(next.configuracion)); setVersion(next.version)
      setLocalItem(next)
      setBaseline(JSON.stringify({nombre: next.nombre, ambito: next.ambito, configuracion: next.configuracion}))
    }
    setLoaded(true); setError('')
    return true
  }
  useEffect(() => {
    if (catalog.data && !loaded) choose('base:periodo', true)
    // Initial hydration only; background refetch must never overwrite unsaved visual edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.data, loaded])
  const setPart = (part: Partial<TemplateDesign>) => setDesign(previous => previous ? {...previous, ...part} : previous)
  const move = (key: TemplateSectionKey, delta: number) => {
    if (!design) return
    const sections = [...design.sections]
    const index = sections.findIndex(item => item.key === key)
    const target = index + delta
    if (target < 0 || target >= sections.length) return
    ;[sections[index], sections[target]] = [sections[target], sections[index]]
    setPart({sections})
  }
  const toggle = (key: TemplateSectionKey) => {
    if (!design || key === 'student' || key === 'subjects') return
    setPart({sections: design.sections.map(item => item.key === key ? {...item, visible: !item.visible} : item)})
  }
  const accept = (item: SavedTemplate, published = false) => {
    setLocalItem(item)
    setSelected(item.token); setName(item.nombre); setScope(item.ambito); setDesign(structuredClone(item.configuracion));
    setVersion(item.version); setBaseline(JSON.stringify({nombre: item.nombre, ambito: item.ambito, configuracion: item.configuracion}))
    setError(''); toast.success(t(published ? 'templates.publishedSuccess' : 'templates.saved'))
  }
  const fail = (reason: Error) => setError(reason.message)
  const createDraft = () => {if (input) create.mutate(input, {onSuccess: item => accept(item), onError: fail})}
  const saveDraft = () => {if (input && current) save.mutate({token: current.token, input: {...input, version}},
    {onSuccess: item => accept(item), onError: fail})}
  const publishRevision = () => {if (input && current) publish.mutate({token: current.token, input: {...input, version}},
    {onSuccess: item => accept(item, true), onError: fail})}
  const visibleCount = useMemo(() => design?.sections.filter(item => item.visible).length ?? 0, [design])

  if (catalog.isError) return <div className='alert alert-danger' role='alert'>{catalog.error?.message ?? t('common.error')}</div>
  if (catalog.isLoading || !catalog.data || !design) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>

  return <div>
    <div className='card mb-6'><div className='card-body d-flex flex-wrap align-items-center justify-content-between gap-3'>
      <div><span className='bulletin-builder-eyebrow'>{t('templates.eyebrow')}</span>
        <h1 className='fs-2 fw-bold mb-1'>{t('templates.title')}</h1><p className='text-muted mb-0'>{t('templates.intro')}</p></div>
      <span className='badge badge-light-warning fs-7'>{t('templates.noEmission')}</span>
    </div></div>
    {!canEdit && <div className='alert alert-info' role='status'>{t('templates.basicPlanHelp')}</div>}
    <div className='bulletin-builder'>
      <div className='bulletin-builder-panel'>
        <div className='d-flex justify-content-between align-items-center mb-4'><div><span className='bulletin-builder-eyebrow'>01 / {t('templates.design')}</span>
          <h2 className='fs-3 fw-bold mb-0'>{t('templates.editPanel')}</h2></div><KTIcon iconName='setting-2' className='fs-2 text-primary' /></div>
        <label className='form-label' htmlFor='bulletin-template-select'>{t('templates.choose')}</label>
        <select id='bulletin-template-select' className='form-select mb-4' value={selected} onChange={event => choose(event.target.value)}>
          <option value='base:periodo'>{t('templates.basePeriod')}</option>
          <option value='base:final'>{t('templates.baseFinal')}</option>
          {templates.map(item => <option key={item.token} value={item.token}>{item.nombre} · {item.ambito === 'final' ? t('templates.final') : t('templates.period')}</option>)}
        </select>
        <div className='d-flex justify-content-between align-items-center mb-5'><span className={`badge ${current?.revision_publicada ? 'badge-light-success' : 'badge-light-secondary'}`}>
          {current ? activeLabel : t('templates.base')}</span><small className='text-muted'>{t('templates.blocksCount')}: {visibleCount}</small></div>
        <fieldset disabled={!canEdit || busy} className='border-0 p-0 m-0'>
          <label className='form-label' htmlFor='bulletin-template-name'>{t('templates.name')}</label>
          <input id='bulletin-template-name' className='form-control mb-4' value={name} maxLength={120}
            onChange={event => setName(event.target.value)} />
          <label className='form-label' htmlFor='bulletin-template-heading'>{t('templates.heading')}</label>
          <input id='bulletin-template-heading' className='form-control mb-4' value={design.heading} maxLength={80}
            onChange={event => setPart({heading: event.target.value})} />
          <label className='form-label' htmlFor='bulletin-template-subheading'>{t('templates.subheading')}</label>
          <input id='bulletin-template-subheading' className='form-control mb-5' value={design.subheading} maxLength={140}
            onChange={event => setPart({subheading: event.target.value})} />
          <div className='separator my-5' />
          <label className='form-label d-block mb-3'>{t('templates.accent')}</label>
          <div className='bulletin-builder-palette mb-3'>{palette.map(color => <button key={color} type='button' className='bulletin-builder-swatch'
            style={{backgroundColor: color}} aria-label={`${t('templates.color')} ${color}`} aria-pressed={design.accent.toLowerCase() === color.toLowerCase()}
            onClick={() => setPart({accent: color})} />)}</div>
          <div className='d-flex align-items-center gap-3 mb-5'><input aria-label={t('templates.customColor')} type='color' value={design.accent}
            onChange={event => setPart({accent: event.target.value})} /><span className='text-muted fs-7'>{t('templates.customColor')}</span></div>
          <div className='row g-3 mb-5'><div className='col-sm-6'><label className='form-label' htmlFor='bulletin-template-font'>{t('templates.font')}</label>
            <select id='bulletin-template-font' className='form-select' value={design.font} onChange={event => setPart({font: event.target.value as TemplateDesign['font']})}>
              {fonts.map(font => <option key={font} value={font}>{t(`templates.font.${font}`)}</option>)}</select></div>
            <div className='col-sm-6'><label className='form-label' htmlFor='bulletin-template-density'>{t('templates.density')}</label>
              <select id='bulletin-template-density' className='form-select' value={design.density} onChange={event => setPart({density: event.target.value as TemplateDesign['density']})}>
                <option value='comfortable'>{t('templates.comfortable')}</option><option value='compact'>{t('templates.compact')}</option></select></div></div>
          <div className='separator my-5' />
          <h3 className='fs-5 fw-bold mb-1'>{t('templates.sections')}</h3><p className='text-muted fs-7'>{t('templates.sectionsHelp')}</p>
          {design.sections.map((section, index) => <div className='bulletin-builder-section' key={section.key}>
            <label className='form-check form-check-custom form-check-solid'>
              <input className='form-check-input' type='checkbox' checked={section.visible} disabled={section.key === 'student' || section.key === 'subjects'}
                onChange={() => toggle(section.key)} /><span className='form-check-label'>{t(`templates.section.${section.key}`)}</span></label>
            <button type='button' className='btn btn-sm btn-icon btn-light' disabled={index === 0} aria-label={`${t('templates.moveUp')} ${t(`templates.section.${section.key}`)}`}
              onClick={() => move(section.key, -1)}><KTIcon iconName='arrow-up' className='fs-5' /></button>
            <button type='button' className='btn btn-sm btn-icon btn-light' disabled={index === design.sections.length - 1}
              aria-label={`${t('templates.moveDown')} ${t(`templates.section.${section.key}`)}`}
              onClick={() => move(section.key, 1)}><KTIcon iconName='arrow-down' className='fs-5' /></button>
          </div>)}
        </fieldset>
        {error && <div className='alert alert-danger mt-4' role='alert'>{error}</div>}
        {canEdit && <div className='d-flex flex-wrap justify-content-end gap-2 mt-5'>
          {!current ? <button className='btn btn-primary' type='button' disabled={busy || !name.trim() || !design.heading.trim()}
            onClick={createDraft}>{t('templates.createDraft')}</button> : <>
            <button className='btn btn-light-primary' type='button' disabled={busy || !dirty} onClick={saveDraft}>{t('templates.saveDraft')}</button>
            <button className='btn btn-primary' type='button' disabled={busy || !name.trim() || !design.heading.trim()}
              onClick={publishRevision}>{t('templates.publish')}</button></>}
        </div>}
        {catalog.data.ultima_pagina > 1 && <nav className='d-flex justify-content-end align-items-center gap-2 mt-5' aria-label={t('templates.pages')}>
          <button className='btn btn-sm btn-light' type='button' disabled={page <= 1} onClick={() => {if (choose('base:periodo')) setPage(page - 1)}}>{t('templates.previous')}</button>
          <span>{page} / {catalog.data.ultima_pagina}</span>
          <button className='btn btn-sm btn-light' type='button' disabled={page >= catalog.data.ultima_pagina} onClick={() => {if (choose('base:periodo')) setPage(page + 1)}}>{t('templates.next')}</button>
        </nav>}
      </div>
      <div className='bulletin-builder-preview'><div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4'>
        <div><span className='bulletin-builder-eyebrow'>02 / {t('templates.livePreview')}</span>
          <h2 className='fs-3 fw-bold mb-0'>{t('templates.previewTitle')}</h2></div>
        <span className={`badge ${dirty ? 'badge-light-warning' : 'badge-light-primary'}`}>{dirty ? t('templates.unsaved') : t('templates.upToDate')}</span>
      </div><TemplateLivePreview design={design} scope={scope} school={school} logoUrl={branding.data?.logo_url} />
      <p className='text-muted fs-8 text-center mt-4 mb-0'>{t('templates.previewNotice')}</p></div>
    </div>
  </div>
}
