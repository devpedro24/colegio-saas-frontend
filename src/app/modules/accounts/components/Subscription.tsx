import {useIntl} from 'react-intl'
import {useQuery} from '@tanstack/react-query'
import {Navigate} from 'react-router-dom'
import {api} from '@/lib/api/client'
import {useAuth} from '../../auth'
import {useImpersonation} from '../../impersonation/impersonation.store'
import {canManageSchoolSubscription} from '../accountAccess'
import type {SubscriptionQuote} from '@/app/pages/config/planes/planes.types'

type SubscriptionSummary = {
  school: string
  labels: Record<string, string>
  plan: {name: string; storage_gb: number | null; features: string[]} | null
  contract: {students: number; sites: number; addons: string[]} | null
  quote: SubscriptionQuote | null
  storage_used: number
}

export function Subscription() {
  const intl = useIntl()
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const t = (id: string) => intl.formatMessage({id})
  const canUpgrade = canManageSchoolSubscription(currentUser)
  const allowed = canUpgrade || !!currentUser?.is_superadmin || (!!currentUser?.is_platform && !!activeColegio)
  const query = useQuery({
    queryKey: ['institution-context', 'subscription', currentUser?.tenant_channel, activeColegio?.slug],
    queryFn: () => api.get<SubscriptionSummary>('/subscription'), enabled: allowed,
  })
  if (!allowed) return <Navigate to='/account/overview' replace />
  if (query.isPending) return <p role='status'>{t('common.pleaseWait')}</p>
  if (query.isError) return <div className='alert alert-danger' role='alert'>
    {query.error.message}
    <button className='btn btn-light ms-4' onClick={() => void query.refetch()}>{t('loginAppearance.retry')}</button>
  </div>

  const data = query.data
  const money = (value: number) => intl.formatNumber(value, {style: 'currency', currency: 'COP', maximumFractionDigits: 0})
  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB']
    const index = bytes > 0 ? Math.max(0, Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)))) : 0
    return intl.formatNumber(bytes / 1024 ** index, {maximumFractionDigits: 1}) + ' ' + units[index]
  }
  const limit = data.plan?.storage_gb
  const storageLimit = !data.plan ? t('account.planUnavailable') : limit === null ? t('common.unlimited') : limit + ' GB'
  const percent = typeof limit === 'number' && limit > 0 ? Math.min(100, Math.max(0, data.storage_used / (limit * 1024 ** 3) * 100)) : null
  const features = data.plan?.features.filter(key => data.labels[key]) ?? []

  return <section className='card mb-5 account-subscription' aria-labelledby='subscription-title'>
    <div className='card-body p-6 p-md-9'>
      <div className='account-subscription__heading mb-8'>
        <div className='account-subscription__intro'>
          <div className='d-flex align-items-center flex-wrap gap-3 mb-3'>
            <span className='text-muted fw-semibold fs-7'>{t('header.user.mySubscription')}</span>
            <span className='badge badge-light-primary'>{data.plan?.name || t('account.planUnavailable')}</span>
          </div>
          <h2 id='subscription-title' className='fs-2 fw-bold mb-3'>{data.school}</h2>
          <p className='text-gray-600 mb-0 lh-lg'>{t('account.subscription.help')}</p>
        </div>
        {canUpgrade && <button className='btn btn-primary' data-bs-toggle='modal' data-bs-target='#kt_modal_upgrade_plan'>
          {t('header.navbar.upgrade')} {t('header.navbar.planWord')}
        </button>}
      </div>

      {!data.contract ? <div className='alert alert-warning'>{t('account.subscription.unconfigured')}</div> : <div className='account-subscription__metrics mb-8'>
        <div className='account-subscription__metric account-subscription__price'>
          <p className='fw-semibold text-gray-700 mb-3'>{t('account.subscription.monthly')}</p>
          <div className='account-subscription__value mb-4'>{data.quote ? money(data.quote.monthly_total) : '—'}</div>
          {data.quote && <div className='fs-7 text-gray-600 lh-lg'>
            {t('account.subscription.annual')}<br /><strong className='text-gray-800'>{money(data.quote.annual_reference)}</strong>
          </div>}
        </div>
        <div className='account-subscription__metric'>
          <i className='ki-solid ki-people fs-2 text-primary d-block mb-4' aria-hidden='true' />
          <div className='account-subscription__value mb-2'>{intl.formatNumber(data.contract.students)}</div>
          <p className='text-gray-600 mb-0'>{t('account.subscription.students')}</p>
        </div>
        <div className='account-subscription__metric'>
          <i className='ki-solid ki-home-2 fs-2 text-primary d-block mb-4' aria-hidden='true' />
          <div className='account-subscription__value mb-2'>{intl.formatNumber(data.contract.sites)}</div>
          <p className='text-gray-600 mb-0'>{t('account.subscription.sites')}</p>
        </div>
      </div>}

      <div className='account-subscription__details'>
        <div>
          {!!features.length && <>
            <h3 className='fs-5 fw-bold mb-5'>{t('account.subscription.features')}</h3>
            <ul className='account-subscription__features'>{features.map(key => <li key={key}>
              <span className='account-subscription__check' aria-hidden='true'>✓</span>
              <span className='text-gray-700'>{intl.formatMessage({id: data.labels[key]})}</span>
            </li>)}</ul>
          </>}
          {!!data.quote?.addon_lines.length && <div className='mt-7'>
            <h3 className='fs-5 fw-bold mb-4'>{t('account.subscription.addons')}</h3>
            <ul className='list-unstyled mb-0'>{data.quote.addon_lines.map(line => <li key={line.key} className='d-flex justify-content-between flex-wrap gap-2 py-3 border-bottom'>
              <span>{data.labels[line.key] ? intl.formatMessage({id: data.labels[line.key]}) : line.key}</span>
              <strong>{money(line.total)}</strong>
            </li>)}</ul>
          </div>}
        </div>
        <div className='account-subscription__storage'>
          <div className='d-flex align-items-center gap-3 mb-4'>
            <i className='ki-solid ki-cloud fs-2 text-primary' aria-hidden='true' />
            <h3 className='fs-5 fw-bold mb-0'>{t('account.subscription.storageTitle')}</h3>
          </div>
          <p className='text-gray-800 fw-semibold mb-3'>{formatSize(data.storage_used)} / {storageLimit}</p>
          {percent !== null && <div className='progress h-8px mb-4' role='progressbar' aria-label={t('account.subscription.storage')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
            <div className={'progress-bar bg-' + (percent >= 90 ? 'warning' : 'primary')} style={{width: percent + '%'}} />
          </div>}
          <p className='text-gray-600 fs-7 mb-0 lh-lg'>{t('account.subscription.storageHelp')}</p>
        </div>
      </div>
      <div className='account-subscription__notice text-gray-600 fs-7 lh-lg'>
        <i className='ki-solid ki-information-2 fs-4 mt-1' aria-hidden='true' />
        <p className='mb-0'>{t('account.subscription.billingHelp')}</p>
      </div>
    </div>
  </section>
}
