import {useState} from 'react'
import {useIntl} from 'react-intl'
import {useQuery} from '@tanstack/react-query'
import {PageTitle} from '../../../_metronic/layout/core'
import {Content} from '../../../_metronic/layout/components/content'
import {LoginAppearanceCard} from '@/app/shared/components/LoginAppearanceCard'
import {api} from '@/lib/api/client'

type School = {slug: string; name: string}

export default function LoginAppearancePage() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [selected, setSelected] = useState<School | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const schools = useQuery({queryKey: ['login-appearance-schools', search, page],
    queryFn: () => api.get<{data: School[]; next_page: number | null}>(
      `/platform/login-appearance/schools?q=${encodeURIComponent(search)}&page=${page}`)})
  const options = schools.data?.data ?? []
  const endpoint = selected ? `/colegios/${encodeURIComponent(selected.slug)}/login-appearance` : '/platform/login-appearance'

  return <>
    <PageTitle>{t('loginAppearance.title')}</PageTitle>
    <Content>
      <div className='card mb-5'><div className='card-body'>
        <label htmlFor='login-appearance-target' className='form-label fw-bold'>{t('loginAppearance.target')}</label>
        <input type='search' className='form-control mb-4' placeholder={t('loginAppearance.search')}
          aria-label={t('loginAppearance.search')} maxLength={120} value={search}
          onChange={event => {setSearch(event.target.value); setPage(1)}} />
        <select id='login-appearance-target' className='form-select' value={selected?.slug ?? ''}
          onChange={event => setSelected(options.find(school => school.slug === event.target.value) ?? null)}>
          <option value=''>{t('loginAppearance.platform')}</option>
          {selected && !options.some(school => school.slug === selected.slug) && <option value={selected.slug}>{selected.name} ({selected.slug})</option>}
          {options.map(school => <option key={school.slug} value={school.slug}>{school.name} ({school.slug})</option>)}
        </select>
        <p className='form-text mb-0'>{t('loginAppearance.targetHelp')}</p>
        <div className='d-flex gap-3 mt-3'>
          {page > 1 && <button className='btn btn-sm btn-light' disabled={schools.isFetching} onClick={() => setPage(page - 1)}>{t('loginAppearance.previous')}</button>}
          {schools.data?.next_page && <button className='btn btn-sm btn-light' disabled={schools.isFetching} onClick={() => setPage(page + 1)}>{t('loginAppearance.next')}</button>}
        </div>
        {schools.isError && <div className='text-danger mt-3' role='alert'>
          {t('loginAppearance.schoolsError')}
          <button className='btn btn-sm btn-light ms-3' onClick={() => void schools.refetch()}>{t('loginAppearance.retry')}</button>
        </div>}
      </div></div>
      {endpoint && <LoginAppearanceCard key={endpoint} endpoint={endpoint} />}
    </Content>
  </>
}
