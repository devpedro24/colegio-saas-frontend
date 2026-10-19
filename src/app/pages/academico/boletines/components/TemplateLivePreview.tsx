import type {CSSProperties, ReactNode} from 'react'
import {useIntl} from 'react-intl'
import type {TemplateDesign, TemplateScope, TemplateSectionKey} from '../plantillas.api'
import '../plantillas.css'

function inkFor(hex: string): string {
  const values = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const brightness = values.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
  return brightness > 0.28 ? '#102235' : '#ffffff'
}

export function TemplateLivePreview({design, scope, school, logoUrl}: {design: TemplateDesign; scope: TemplateScope; school: string; logoUrl?: string | null}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const blocks: Record<TemplateSectionKey, ReactNode> = {
    student: <div className='bulletin-sample-grid'>
      <div><small>{t('templates.studentName')}</small><strong>{t('templates.sampleName')}</strong></div>
      <div><small>{t('templates.gradeGroup')}</small><strong>{t('templates.sampleGrade')}</strong></div>
      <div><small>{t('templates.period')}</small><strong>{scope === 'final' ? t('templates.finalYear') : t('templates.firstPeriod')}</strong></div>
      <div><small>{t('templates.year')}</small><strong>2026</strong></div>
    </div>,
    areas: <table className='bulletin-sample-table'><thead><tr><th>{t('templates.area')}</th><th>{t('templates.result')}</th></tr></thead>
      <tbody><tr><td>{t('templates.sampleAreaOne')}</td><td>4,4</td></tr>
        <tr><td>{t('templates.sampleAreaTwo')}</td><td>4,2</td></tr></tbody></table>,
    subjects: <table className='bulletin-sample-table'><thead><tr><th>{t('templates.subject')}</th>
      <th>{scope === 'final' ? t('templates.finalResult') : t('templates.periodResult')}</th></tr></thead>
      <tbody><tr><td>{t('templates.sampleSubjectOne')}</td><td>4,5</td></tr>
        <tr><td>{t('templates.sampleSubjectTwo')}</td><td>4,1</td></tr>
        <tr><td>{t('templates.sampleSubjectThree')}</td><td>4,3</td></tr></tbody></table>,
    indicators: <div className='bulletin-sample-indicator'><i className='ki-solid ki-check-circle fs-2' aria-hidden='true' />
      <span>{t('templates.sampleIndicator')}</span><strong>{t('templates.achieved')}</strong></div>,
    observations: <p className='bulletin-sample-observation'>{t('templates.sampleObservation')}</p>,
    attendance: <div className='bulletin-sample-attendance'><span>{t('templates.absences')}</span><strong>2</strong></div>,
    signature: <div className='bulletin-sample-signature'><span>{t('templates.authorizedSignature')}</span></div>,
  }
  const style = {'--bulletin-accent': design.accent, '--bulletin-ink': inkFor(design.accent)} as CSSProperties
  return <div className={`bulletin-sample bulletin-sample--${design.font} bulletin-sample--${design.density}`} style={style}>
    <div className='bulletin-sample-topline'><span>{t('templates.livePreview')}</span><span>{t('templates.sampleOnly')}</span></div>
    <div className='bulletin-sample-header'><div className='bulletin-sample-monogram' aria-hidden='true'>
      {logoUrl ? <img src={logoUrl} alt='' /> : school.trim().charAt(0).toUpperCase()}
    </div>
      <div><span className='bulletin-sample-school'>{school}</span><h2>{design.heading}</h2>
        {design.subheading && <p>{design.subheading}</p>}</div></div>
    <div className='bulletin-sample-body'>
      {design.sections.filter(section => section.visible).map(section => <section key={section.key} className='bulletin-sample-section'>
        <h3><span>{t(`templates.section.${section.key}`)}</span><i className='ki-solid ki-arrow-right fs-5' aria-hidden='true' /></h3>
        {blocks[section.key]}
      </section>)}
    </div>
    <div className='bulletin-sample-footer'><span>{school}</span><strong>{t('templates.notOfficial')}</strong></div>
  </div>
}
