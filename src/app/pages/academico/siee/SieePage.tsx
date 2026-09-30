import {FC, useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {PageLink, PageTitle} from '@/_metronic/layout/core'
import {Content} from '@/_metronic/layout/components/content'
import {useAnosLectivos} from '../anos-lectivos/anos-lectivos.api'
import {SieeConfigPanel} from './components/SieeConfigPanel'

const SieePage: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  const breadcrumbs: Array<PageLink> = [
    {title: t('academico.title'), path: '/academico/anos-lectivos', isSeparator: false, isActive: false},
    {title: '', path: '', isSeparator: true, isActive: false},
  ]

  const {data: anos, isLoading, error} = useAnosLectivos()
  const anosList = useMemo(() => anos?.data ?? [], [anos])
  const [anoLectivoToken, setAnoLectivoToken] = useState<string>('')

  useEffect(() => {
    if (anoLectivoToken || anosList.length === 0) return
    const enCurso = anosList.find((a) => a.estado === 'en_curso')
    setAnoLectivoToken((enCurso ?? anosList[0]).url_token)
  }, [anosList, anoLectivoToken])

  const noYears = anosList.length === 0
  const selectedYear = anosList.find((year) => year.url_token === anoLectivoToken)

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>
        {t('academico.siee.title')}
      </PageTitle>
      <Content>
        <div className='card mb-6'>
          <div className='card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4 py-6'>
            <div>
              <h3 className='fw-bold mb-1'>{t('academico.siee.title')}</h3>
              <span className='text-muted fs-7'>
                {t('academico.siee.desc')}
              </span>
            </div>
            <div className='d-flex flex-column'>
              <label htmlFor='siee-year' className='fs-8 fw-semibold text-muted mb-1'>{t('academico.config.yearLabel')}</label>
              <select
                id='siee-year'
                className='form-select form-select-solid w-md-250px'
                value={anoLectivoToken}
                disabled={noYears}
                onChange={(e) => setAnoLectivoToken(e.target.value)}
              >
                {anosList.map((a) => (
                  <option key={a.url_token} value={a.url_token}>{a.nombre}</option>
                ))}
                {noYears && <option value=''>—</option>}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? <div role='status'>{t('common.loading')}</div> : error ? <div className='alert alert-danger' role='alert'>{error.message}</div> : noYears ? (
          <div className='alert alert-warning'>
            {t('academico.config.noYears')}
          </div>
        ) : (
          selectedYear && <SieeConfigPanel key={selectedYear.url_token}
            anoLectivoToken={selectedYear.url_token} />
        )}
      </Content>
    </>
  )
}

export default SieePage
