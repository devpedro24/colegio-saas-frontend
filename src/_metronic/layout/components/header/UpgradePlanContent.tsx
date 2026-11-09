import {useEffect, useMemo, useState, type CSSProperties} from 'react'
import {useUpgradeIntl} from './useUpgradeIntl'
import {useQuery} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useAuth} from '@/app/modules/auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {NumberInput} from '@/app/shared/components/NumberInput'
import {comparisonLimits, getUpgradeModalHtml, type SubscriptionOffers} from './_UpgradeModalContent'
import '@/app/pages/config/planes/commercial.scss'

type Capacity = {students: number; sites: number}
export default function UpgradePlanContent() {
  const intl = useUpgradeIntl(), {currentUser} = useAuth(), {activeColegio} = useImpersonation()
  const t = (id: string) => intl.formatMessage({id})
  const [selected, setSelected] = useState<string | null>(null), [annual, setAnnual] = useState(false)
  const [contact, setContact] = useState(false), [capacity, setCapacity] = useState<Capacity | null>(null)
  const [settled, setSettled] = useState<Capacity | null>(null)
  useEffect(() => {const timer = setTimeout(() => setSettled(capacity), 250); return () => clearTimeout(timer)}, [capacity])
  useEffect(() => {
    const element = document.getElementById('kt_modal_upgrade_plan')
    const reset = () => {setSelected(null); setContact(false); setCapacity(null); setSettled(null)}
    element?.addEventListener('show.bs.modal', reset)
    return () => element?.removeEventListener('show.bs.modal', reset)
  }, [])
  const scope = [currentUser?.tenant_channel, activeColegio?.slug, intl.locale]
  const query = useQuery({queryKey: ['institution-context', 'offers', ...scope, settled],
    queryFn: () => api.get<SubscriptionOffers>((currentUser?.is_platform && !activeColegio ? '/plans/offers' : '/subscription/offers')
      + (settled ? `?students=${settled.students}&sites=${settled.sites}` : '')),
    enabled: !!currentUser && (!settled || (settled.students >= 30 && settled.students <= 100000 && settled.sites >= 1 && settled.sites <= 100)),
    placeholderData: (previous, previousQuery) => scope.every((value, index) => value === previousQuery?.queryKey[index + 2]) ? previous : undefined,
    staleTime: 60_000, retry: false})
  const baseline = query.data?.current?.quote ?? query.data?.data[0]?.quote
  const values = capacity ?? {students: baseline?.students ?? 30, sites: baseline?.sites ?? 1}
  const clamp = (field: keyof Capacity, value: number) => Math.min(field === 'students' ? 100000 : 100, Math.max(field === 'students' ? 30 : 1, value))
  // Keep the same DOM while a field loses focus or a background quote is fetching.
  // Replacing it between pointer-down and pointer-up would cancel the card click.
  const comparisonHtml = useMemo(() => ({__html: getUpgradeModalHtml(intl, query.data,
    selected ?? (query.data?.current?.customized ? 'custom' : query.data?.current?.key) ?? query.data?.data[0]?.key ?? '',
    annual, contact, query.isError, {students:values.students,sites:values.sites})}),
  [intl, query.data, selected, annual, contact, query.isError, values.students, values.sites])
  return <div className='modal-content rounded'>
    <div className='modal-header justify-content-end border-0 pb-0'>
      <button type='button' className='btn btn-sm btn-icon btn-active-color-primary' data-bs-dismiss='modal' aria-label={t('common.close')}>
        <i className='ki-duotone ki-cross fs-1'><span className='path1' /><span className='path2' /></i>
      </button>
    </div>
    <div className='modal-body pt-0 pb-8 px-5 px-xl-20'>
      <div className='mb-6 text-center'><h1 className='mb-2'>{t('header.upgrade.title')}</h1>
        <p className='text-muted fw-semibold fs-6 mb-2'>{t('upgrade.catalogHelp')}</p>
      </div>
      <div className='upgrade-capacity-grid mb-5'>
        {(['students', 'sites'] as const).map(field => {
          const minimum = field === 'students' ? 30 : 1
          const limit = field === 'students' ? comparisonLimits(query.data).max_students : comparisonLimits(query.data).max_sites
          const sliderMax = limit + 1
          const progress = Math.max(0, Math.min(100, (values[field] - minimum) / (sliderMax - minimum) * 100))
          return <section className={`upgrade-capacity-card capacity-${field}`} key={field}>
            <div className='upgrade-capacity-heading'>
              <label htmlFor={`upgrade-${field}`}><span className='upgrade-capacity-icon' aria-hidden='true'>
                <i className={`ki-duotone ${field === 'students' ? 'ki-profile-user' : 'ki-bank'} fs-2`}><span className='path1' /><span className='path2' /><span className='path3' /></i>
              </span><span>{t(`upgrade.${field}`)}</span></label>
              <NumberInput id={`upgrade-${field}`} className='upgrade-capacity-value' min={minimum} max={field === 'students' ? 100000 : 100}
                value={values[field]} onChange={event => setCapacity({...values, [field]: Number(event.target.value)})}
                onBlur={event => {
                  const value = clamp(field, Number(event.target.value))
                  if (value !== values[field]) setCapacity({...values, [field]: value})
                }} />
            </div>
            <input className='upgrade-capacity-range' type='range' min={minimum} max={sliderMax} id={`upgrade-${field}-range`}
              style={{'--upgrade-range-fill': `${progress}%`} as CSSProperties}
              aria-label={t(`upgrade.${field}`)} aria-valuetext={values[field] > limit ? `${limit}+` : String(values[field])}
              value={Math.min(sliderMax, Math.max(minimum, values[field]))}
              onChange={event => setCapacity({...values, [field]: Number(event.target.value)})} />
            <div className='upgrade-range-labels' aria-hidden='true'><span>{minimum}</span>
              <span style={{position:'absolute',left:`${((field === 'students' ? comparisonLimits(query.data).premium_after_students : 3) - minimum) / (sliderMax - minimum) * 100}%`,transform:'translateX(-50%)'}}>{field === 'students' ? comparisonLimits(query.data).premium_after_students : 3}</span><span>{limit}+</span>
            </div>
          </section>
        })}
      </div>
      <small className='upgrade-simulation-help'>{t('upgrade.simulationHelp')}</small>
      {query.isFetching && query.data && <span className='visually-hidden' role='status'>{t('common.pleaseWait')}</span>}
      <div aria-busy={query.isFetching} onClick={event => {
        const target = event.target as HTMLElement, cycle = target.closest<HTMLElement>('[data-upgrade-cycle]')
        const plan = target.closest<HTMLElement>('[data-upgrade-select]')
        if (cycle) setAnnual(cycle.dataset.upgradeCycle === 'annual')
        if (plan) {setSelected(plan.dataset.upgradeSelect ?? null); setContact(false)}
        if (target.closest('[data-upgrade-contact]')) {
          setSelected('custom'); setContact(value => !value)
          requestAnimationFrame(() => document.querySelector('.upgrade-contact-note')?.scrollIntoView({block:'nearest'}))
        }
        if (target.closest('[data-upgrade-retry]')) void query.refetch()
      }} dangerouslySetInnerHTML={comparisonHtml} />
    </div>
  </div>
}
