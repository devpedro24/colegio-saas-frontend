import type {IntlShape} from 'react-intl'
import type {PlanFeature, PricingRules, SubscriptionQuote} from '@/app/pages/config/planes/planes.types'

export type Capacity = {students: number; sites: number}
export type SubscriptionOffer = {key: string; name: string; description: string | null; features: string[];
  pricing: PricingRules; storage_gb: number | null; quote: SubscriptionQuote}
export type SubscriptionOffers = {data: SubscriptionOffer[]; catalog: {features: PlanFeature[]};
  comparison?: {max_students: number; max_sites: number; premium_after_students: number; requires_proposal: boolean};
  current: {key: string; name: string; customized?: boolean; features: string[]; quote: SubscriptionQuote} | null}

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!))
export function comparisonLimits(response?: SubscriptionOffers) {
  return response?.comparison ?? {max_students:1000,max_sites:5,premium_after_students:400}
}
export function offerCapacity(response?: SubscriptionOffers, selection?: Capacity): Capacity {
  const quote = response?.current?.quote ?? response?.data[0]?.quote
  return selection ?? {students:quote?.students ?? 30,sites:quote?.sites ?? 1}
}
export function requiresProposal(response?: SubscriptionOffers, selection?: Capacity): boolean {
  const capacity = offerCapacity(response, selection), limits = comparisonLimits(response)
  return capacity.students > limits.max_students || capacity.sites > limits.max_sites
}
export function recommendOffer(response: SubscriptionOffers, selection?: Capacity): {key: string; reason: string} {
  const premium = response.data.find(plan => plan.key === 'premium'), standard = response.data.find(plan => plan.key === 'estandar')
  const capacity = offerCapacity(response, selection)
  if (requiresProposal(response, capacity) || response.current?.customized) return {key:'custom',reason:'upgrade.recommendCustom'}
  if (premium && capacity.students > comparisonLimits(response).premium_after_students) return {key:'premium',reason:'upgrade.recommendGrowing'}
  if (premium && (capacity.sites > 1 || response.current?.features.some(key => ['asistencia','preinformes','aula','boletines_personalizables'].includes(key) && !standard?.features.includes(key)))) return {key:'premium',reason:'upgrade.recommendPremium'}
  if (premium && standard && premium.quote.monthly_total <= standard.quote.monthly_total) return {key:'premium',reason:'upgrade.recommendValue'}
  return {key:response.data[0]?.key ?? 'custom',reason:'upgrade.recommendStandard'}
}

const icons: Record<string,string> = {
  capacity:'<rect x="3" y="8" width="18" height="13" rx="3"/><path d="M8 8V5a4 4 0 0 1 8 0v3M8 13h8M8 17h5"/>',
  tools:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  school:'<path d="M4 21V8l8-5 8 5v13M2 21h20M9 21v-6h6v6M7 9h.01M17 9h.01M7 12h.01M17 12h.01"/><circle cx="12" cy="9" r="1.5"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
}
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.tools}</svg>`

export function getUpgradeModalHtml(intl: IntlShape, response: SubscriptionOffers | undefined,
  selected: string, annual: boolean, contact: boolean, failed: boolean, selection?: Capacity): string {
  const t = (id: string, values?: Record<string, string | number>) => escape(intl.formatMessage({id}, values))
  const money = (amount: number) => escape(intl.formatNumber(amount, {style:'currency',currency:'COP',maximumFractionDigits:0}))
  const current = response?.current, offers = response?.data ?? [], offer = offers.find(plan => plan.key === selected)
  const capacity = offerCapacity(response, selection), proposal = requiresProposal(response, capacity)
  const custom = selected === 'custom' || proposal, isCurrent = !current?.customized && selected === current?.key
  const featureKeys = isCurrent || (custom && current?.customized) ? [...(offer?.features ?? []), ...(current?.features ?? [])] : offer?.features ?? []
  const features = response?.catalog.features.filter(feature => featureKeys.includes(feature.key)) ?? []
  const recommendation = response ? recommendOffer(response, capacity) : null
  const badge = (key: string) => key === recommendation?.key ? `<span class="upgrade-recommendation" title="${t(recommendation.reason)}">✦ ${t('upgrade.recommended')}</span>` : ''
  const currentPin = (key: string) => current && key === (current.customized ? 'custom' : current.key) ? `<span class="upgrade-current-pin">✓ ${t('upgrade.currentPlan')}</span>` : ''
  const contactButton = (extra = '', label = 'upgrade.requestProposal') => `<button type="button" class="btn upgrade-proposal-button ${extra}" data-upgrade-contact aria-expanded="${contact}">${t(label)}${icon('arrow')}</button>`
  const price = (quote: SubscriptionQuote) => quote.students === capacity.students && quote.sites === capacity.sites
    ? money(quote.monthly_total * (annual ? 12 : 1))
    : `<span class="upgrade-price-pending" role="status">${t('upgrade.updatingPrice')}</span>`
  const period = t(annual ? 'upgrade.year' : 'header.upgrade.periodMon')
  const customPanel = (large: boolean) => `<section class="upgrade-custom-panel ${large ? 'upgrade-custom-panel-large' : ''}">
    <div class="upgrade-custom-art" aria-hidden="true"><span class="upgrade-orbit orbit-one"></span><span class="upgrade-orbit orbit-two"></span><span class="upgrade-school-mark">${icon('school')}</span><span class="upgrade-spark spark-one">✦</span><span class="upgrade-spark spark-two">✦</span></div>
    <span class="upgrade-custom-eyebrow">${t('upgrade.customEyebrow')}</span>
    <h2>${t(large ? 'upgrade.proposalTitle' : 'upgrade.customTitle')}</h2>
    <p>${t(large ? 'upgrade.proposalDescription' : 'upgrade.customDescription')}</p>
    ${large ? `<div class="upgrade-proposal-quantities"><span>${t('upgrade.proposalStudents',{count:capacity.students})}</span><span>${t('upgrade.proposalSites',{count:capacity.sites})}</span></div>` : ''}
    <div class="upgrade-custom-tiles">${[['capacity','upgrade.customCapacity'],['tools','upgrade.customTools'],['school','upgrade.customAgreement']].map(([glyph,label])=>`<div>${icon(glyph)}<span>${t(label)}</span></div>`).join('')}</div>
    ${contactButton('w-100')}
    <small>${t('upgrade.customNoCommitment')}</small>
  </section>`
  const featureList = features.map(feature => `<div class="upgrade-feature"><i class="ki-duotone ${feature.available === false ? 'ki-time text-warning' : 'ki-check-circle text-success'} fs-2"><span class="path1"></span><span class="path2"></span></i><div><div class="fw-semibold fs-6">${t(feature.label)}${feature.available === false ? ` <span class="badge badge-light-warning">${t('upgrade.comingSoon')}</span>` : ''}</div><div class="fs-7 text-muted mt-1">${t(feature.description)}</div></div></div>`).join('')
  return `<div class="upgrade-plan-comparison ${proposal ? 'is-proposal' : ''}">
    ${!proposal ? `<div class="nav-group nav-group-outline mx-auto mb-6" role="group" aria-label="${t('upgrade.billing')}">
      <button type="button" class="btn btn-color-gray-500 btn-active btn-active-secondary px-6 py-3 me-2 ${annual ? '' : 'active'}" data-upgrade-cycle="month" aria-pressed="${!annual}">${t('header.upgrade.monthly')}</button>
      <button type="button" class="btn btn-color-gray-500 btn-active btn-active-secondary px-6 py-3 ${annual ? 'active' : ''}" data-upgrade-cycle="annual" aria-pressed="${annual}">${t('header.upgrade.annual')}</button>
    </div>` : ''}
    ${!response ? `<div class="text-center p-10" role="status">${t(failed ? 'upgrade.error' : 'common.pleaseWait')}${failed ? `<button type="button" class="btn btn-light-primary ms-3" data-upgrade-retry>${t('upgrade.retry')}</button>` : ''}</div>` : proposal ? `<div class="upgrade-plans-stage" data-upgrade-proposal>${customPanel(true)}</div>` : `<div class="row g-5 upgrade-plans-stage">
      <div class="col-lg-6"><div class="upgrade-choices" role="tablist">
        ${offers.map(plan => `<button type="button" role="tab" aria-selected="${selected === plan.key}" aria-controls="kt_upgrade_plan_details" class="upgrade-choice ${selected === plan.key ? 'is-selected' : ''} ${recommendation?.key === plan.key ? 'is-recommended' : ''}" data-upgrade-select="${escape(plan.key)}">
          ${badge(plan.key)}${currentPin(plan.key)}
          <span class="upgrade-choice-info"><span class="upgrade-radio" aria-hidden="true"></span><span><span class="upgrade-plan-name">${escape(plan.name)}</span><span class="upgrade-unit-price">${money(plan.quote.student_monthly ?? plan.pricing.student_monthly)} ${t('upgrade.perStudentMonth')}</span></span></span>
          <span class="upgrade-plan-price"><strong data-upgrade-total="${escape(plan.key)}">${price(plan.quote)}</strong><span>/ ${period}</span></span>
        </button>`).join('')}
        <button type="button" role="tab" aria-selected="${custom}" aria-controls="kt_upgrade_plan_details" class="upgrade-choice upgrade-custom-choice ${custom ? 'is-selected' : ''} ${recommendation?.key === 'custom' ? 'is-recommended' : ''}" data-upgrade-select="custom">
          ${badge('custom')}${currentPin('custom')}
          <span class="upgrade-choice-info"><span class="upgrade-radio" aria-hidden="true"></span><span><span class="upgrade-plan-name">${t('header.upgrade.custom')}</span><span class="upgrade-unit-price">${t('upgrade.customHelp')}</span></span></span>
          <span class="upgrade-choice-art" aria-hidden="true">${icon('tools')}</span>
          ${current?.customized ? `<span class="upgrade-custom-total">${price(current.quote)} / ${period}</span>` : ''}
        </button>
      </div></div>
      <div class="col-lg-6"><div class="upgrade-details ${custom ? 'is-custom' : ''}" id="kt_upgrade_plan_details" role="tabpanel">
        ${custom ? `<div class="upgrade-features upgrade-custom-scroll">${customPanel(false)}${current?.customized ? featureList : ''}</div>` : `<h2>${t('header.upgrade.whatsIncluded')}</h2><div class="upgrade-description text-muted fs-7">${escape(offer?.description)}</div><div class="upgrade-features">${featureList}<div class="fs-7 text-muted">${t(featureKeys.includes('soporte_prioritario') ? 'upgrade.prioritySupport' : 'upgrade.standardSupport')}</div></div>`}
      </div></div>
    </div>`}
    ${contact ? `<div class="upgrade-contact-note" role="status">${icon('school')}<span>${t('upgrade.contactHelp')}</span></div>` : ''}
    <footer class="upgrade-comparison-footer"><small>${t('upgrade.annualHelp')}</small><div class="upgrade-footer-actions"><button type="button" class="btn btn-light" data-bs-dismiss="modal">${t('common.cancel')}</button>${response && !custom ? contactButton('', 'header.menu.contactUs') : ''}</div></footer>
  </div>`
}
