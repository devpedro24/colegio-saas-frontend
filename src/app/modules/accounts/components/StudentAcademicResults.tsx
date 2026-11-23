import {useQuery} from '@tanstack/react-query'
import {FormattedMessage, useIntl} from 'react-intl'
import {api} from '@/lib/api/client'

type Result = {
  token: string
  ano: string
  materia: string
  periodo: string
  estado: 'calculado' | 'pendiente'
  origen: string
  nota: string | null
}

export function StudentAcademicResults({student, tenant}: {student: string; tenant?: string | null}) {
  const intl = useIntl()
  const results = useQuery({
    queryKey: ['evaluacion', 'mis-resultados', tenant, student],
    queryFn: () => api.get<{data: Result[]}>('/ingreso/mis-resultados').then(response => response.data),
  })
  return <section className='card mb-5' aria-labelledby='student-results-title'>
    <div className='card-header'><h3 className='card-title' id='student-results-title'><FormattedMessage id='account.results.title' /></h3></div>
    <div className='card-body' aria-live='polite'>
      {results.isLoading && <FormattedMessage id='account.results.loading' />}
      {results.isError ? <div role='alert'><FormattedMessage id='account.results.error' />{' '}
        <button type='button' className='btn btn-sm btn-light' onClick={() => results.refetch()}>
          <FormattedMessage id='intake.settings.retry' /></button></div>
      : results.data?.length === 0 ? <FormattedMessage id='account.results.empty' />
      : <ul className='list-unstyled mb-0'>{results.data?.map(row =>
        <li className='d-flex flex-wrap align-items-center justify-content-between border-bottom py-3 gap-2' key={row.token}>
          <div><strong className='text-break'>{row.materia}</strong>
            <div className='text-gray-600'>{row.ano} · <FormattedMessage id='account.results.period' values={{period: row.periodo}} /></div>
          </div>
          <div className='d-flex align-items-center flex-wrap gap-3'>
            <span className={`badge text-wrap badge-light-${row.estado === 'pendiente' ? 'warning' : 'success'}`}>
              <FormattedMessage id={`account.results.${row.origen}`} /></span>
            {row.nota != null && <strong>{/^\d+(\.\d+)?$/.test(row.nota)
              ? intl.formatNumber(Number(row.nota), {minimumFractionDigits: row.nota.split('.')[1]?.length ?? 0})
              : row.nota}</strong>}
          </div>
        </li>)}</ul>}
    </div>
  </section>
}
