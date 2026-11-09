import {NumberInput} from '@/app/shared/components/NumberInput'
import {useCommercialText} from '../useCommercialText'
import {useEffect, useRef, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import {usePlanes} from '../planes.api'
import type {SubscriptionInput, SubscriptionQuote} from '../planes.types'

export default function SubscriptionConfigurator({planKey, value, onChange}: {
  planKey: string; value: SubscriptionInput; onChange: (next: SubscriptionInput) => void
}) {
  const intl = useIntl(), t = useCommercialText()
  const catalog = usePlanes(), plan = catalog.data?.data.find(item => item.key === planKey)
  const minimum = plan?.pricing?.minimum_students ?? 30
  const includedSites = plan?.pricing?.included_sites ?? 1
  const appliedRules = useRef('')
  useEffect(() => {
    if (!plan) return
    const rules = `${plan.key}:${minimum}:${includedSites}`
    if (appliedRules.current === rules) return
    appliedRules.current = rules
    if (value.students < minimum || value.sites < 1) {
      onChange({...value, students: Math.max(minimum, value.students), sites: Math.max(1, value.sites)})
    }
  }, [plan, value, minimum, includedSites, onChange])
  const [settled, setSettled] = useState({planKey, value})
  useEffect(() => {const timeout = setTimeout(() => setSettled({planKey, value}), 250); return () => clearTimeout(timeout)}, [planKey, value])
  const quoteInput = {...settled.value, discount_percent: settled.value.discount_percent ?? 0}
  const quote = useQuery({queryKey: ['plans', 'quote', planKey, quoteInput], enabled: !!plan && settled.planKey === planKey && settled.value.students >= minimum && settled.value.sites >= 1,
    queryFn: () => api.post<{quote: SubscriptionQuote}>('/plans/quote', {plan: planKey, subscription: quoteInput}),
    placeholderData: (previous, query) => query?.queryKey[2] === planKey ? previous : undefined,
    staleTime: 60_000, retry: false})
  const money = (amount: number) => intl.formatNumber(amount, {style: 'currency', currency: 'COP', maximumFractionDigits: 0})
  const addons = Object.entries(plan?.pricing?.addons ?? {}).filter(([key]) => !plan?.features.includes(key))
  const customRates = value.pricing_override ?? {student_monthly: plan?.pricing.student_monthly ?? 1500,
    included_sites: plan?.pricing.included_sites ?? 1, additional_site_monthly: plan?.pricing.additional_site_monthly ?? 15000}
  return <section className='border rounded-4 p-5 mb-7' aria-label={t('commercial.configuration')}>
    <h4>{t('commercial.configuration')}</h4>
    <p className='text-muted fs-7'>{t('commercial.minimumHelp', {minimum})}</p>
    {value.customized && <div className='rounded-3 bg-light-info p-4 mb-5'>
      <h5>{t('commercial.customTitle')}</h5><p className='fs-7'>{t('commercial.customHelp')}</p>
      <div className='row g-3'>{(['student_monthly', 'included_sites', 'additional_site_monthly'] as const).map(field =>
        <label className='col-sm-6' key={field}>{t(`commercial.${field}`)}
          <NumberInput className='form-control mt-2' min={field === 'included_sites' ? 1 : 0}
            max={field === 'included_sites' ? 100 : 10000000} step={1} required value={customRates[field]}
            onBlur={event => {const amount = Math.max(field === 'included_sites' ? 1 : 0, Number(event.target.value));
              if (amount !== customRates[field]) onChange({...value, pricing_override: {...customRates, [field]: amount}})}}
            onChange={event => onChange({...value, pricing_override: {...customRates, [field]: Number(event.target.value)}})} />
        </label>)}</div>
    </div>}
    <div className='row g-4'>
      <label className='col-sm-6'>{t('commercial.students')}
        <NumberInput className='form-control mt-2' type='number' min={minimum} max={100000} required value={value.students}
          onBlur={event => {const students = Math.max(minimum, Number(event.target.value) || minimum); if (students !== value.students) onChange({...value, students})}}
          onChange={event => onChange({...value, students: Number(event.target.value)})} /></label>
      <label className='col-sm-6'>{t('commercial.sites')}
        <NumberInput className='form-control mt-2' type='number' min={1} max={100} required value={value.sites}
          onBlur={event => {const sites = Math.max(1, Number(event.target.value) || 1); if (sites !== value.sites) onChange({...value, sites})}}
          onChange={event => onChange({...value, sites: Number(event.target.value)})} /></label>
    </div>
    <p className='fs-8 text-muted mt-3'>{t('commercial.sitesHelp')}</p>
    <label className='d-block mt-4'>{t('commercial.discountPercent')}
      <NumberInput className='form-control mt-2' min={0} max={100} step='0.01' value={value.discount_percent ?? 0}
        onChange={event => onChange({...value, discount_percent: Number(event.target.value)})} />
      <small className='text-muted'>{t('commercial.discountHelp')}</small>
    </label>
    <div className='d-flex flex-column gap-3 my-5'>
      {addons.map(([key, amount]) => <label key={key} className='d-flex align-items-center gap-3'>
        <input type='checkbox' className='form-check-input' checked={value.addons.includes(key)}
          onChange={event => onChange({...value, addons: event.target.checked ? [...value.addons, key] : value.addons.filter(item => item !== key)})} />
        <span>{t(catalog.data?.catalog.features.find(feature => feature.key === key)?.label ?? 'commercial.addon')} · {money(amount)} {t('commercial.perStudent')}</span>
      </label>)}
    </div>
    {quote.isFetching && !quote.data && <p role='status'>{t('commercial.calculating')}</p>}
    {quote.isError && <p className='text-danger' role='alert'>{t('commercial.quoteError')}</p>}
    {quote.data && !quote.isError && <div className='bg-light-primary rounded-3 p-4' aria-live='polite' aria-busy={quote.isFetching}
      style={{opacity: quote.isFetching ? 0.65 : 1}}>
      {quote.isFetching && <span className='visually-hidden' role='status'>{t('commercial.calculating')}</span>}
      <div className='d-flex justify-content-between gap-3'><span>{quote.data.quote.students} × {money(quote.data.quote.base_student_monthly)}</span><b>{money(quote.data.quote.students_total)}</b></div>
      {quote.data.quote.addon_lines.map(line => <div key={line.key} className='d-flex justify-content-between gap-3'><span>{t(catalog.data?.catalog.features.find(feature => feature.key === line.key)?.label ?? 'commercial.addon')}</span><b>{money(line.total)}</b></div>)}
      <div className='d-flex justify-content-between gap-3'><span>{t('commercial.extraSites')} ({quote.data.quote.additional_sites})</span><b>{money(quote.data.quote.sites_total)}</b></div>
      {quote.data.quote.discount_percent > 0 && <div className='d-flex justify-content-between gap-3'><span>{t('commercial.discountPercent')} ({quote.data.quote.discount_percent}%)</span><b>−{money(quote.data.quote.discount_total)}</b></div>}
      <hr /><div className='d-flex justify-content-between gap-3 fs-3'><strong>{t('commercial.monthlyTotal')}</strong><strong>{money(quote.data.quote.monthly_total)}</strong></div>
      <div className='d-flex justify-content-between gap-3 my-2'><span>{t('commercial.annualTotal')}</span><b>{money(quote.data.quote.annual_reference)}</b></div>
      <small>{t('commercial.monthlyHelp')}</small>
      {planKey === 'estandar' && quote.data.quote.monthly_total >= value.students * (catalog.data?.data.find(item => item.key === 'premium')?.pricing?.student_monthly ?? Infinity) && <p className='mt-3 mb-0'>{t('commercial.comparePremium')}</p>}
    </div>}
  </section>
}
