import {FC, useEffect, useMemo, useState} from 'react'
import {useIntl} from 'react-intl'
import {useSearchParams} from 'react-router-dom'
import {PageLink, PageTitle} from '../../../../_metronic/layout/core'
import {Content} from '../../../../_metronic/layout/components/content'
import {useAnosLectivos} from '../anos-lectivos/anos-lectivos.api'
import {DatosInstitucionalesCard} from './components/DatosInstitucionalesCard'
import {EscalasCard} from './components/EscalasCard'
import {MetodosAprobacionCard} from './components/MetodosAprobacionCard'
import {ModelosPedagogicosCard} from './components/ModelosPedagogicosCard'
import {SedesConfigTab} from './components/SedesConfigTab'

type Tab = 'datos' | 'escala' | 'metodo' | 'modelo' | 'sedes'

const ConfiguracionColegioPage: FC = () => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  const breadcrumbs: Array<PageLink> = [
    {
      title: t('academico.title'),
      path: '/academico/configuracion',
      isSeparator: false,
      isActive: false,
    },
  ]

  // Soporta /academico/configuracion?tab=sedes (enlace "Volver" desde el detalle de una sede).
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const valid: Tab[] = ['datos', 'escala', 'metodo', 'modelo', 'sedes']
    const requested = searchParams.get('tab') as Tab | null
    return requested && valid.includes(requested) ? requested : 'datos'
  })
  const [anoLectivoId, setAnoLectivoId] = useState<string>('')

  const {data: anos} = useAnosLectivos()
  const anosList = useMemo(() => anos ?? [], [anos])

  // Selecciona por defecto el ano en curso; si no hay, el primero de la lista.
  useEffect(() => {
    if (anoLectivoId || anosList.length === 0) return
    const enCurso = anosList.find((a) => a.estado === 'en_curso')
    setAnoLectivoId((enCurso ?? anosList[0]).id)
  }, [anosList, anoLectivoId])

  const yearScoped = tab !== 'datos' && tab !== 'sedes'
  const noYears = anosList.length === 0

  const tabs: Array<{key: Tab; label: string}> = [
    {key: 'datos', label: t('academico.config.tab.datos')},
    {key: 'sedes', label: t('academico.config.tab.sedes')},
    {key: 'escala', label: t('academico.config.tab.escala')},
    {key: 'metodo', label: t('academico.config.tab.metodo')},
    {key: 'modelo', label: t('academico.config.tab.modelo')},
  ]

  return (
    <>
      <PageTitle breadcrumbs={breadcrumbs}>{t('academico.config.title')}</PageTitle>
      <Content>
        {/* Cabecera: subtitulo + selector de ano lectivo */}
        <div className='card mb-6'>
          <div className='card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4 py-6'>
            <div>
              <h3 className='fw-bold mb-1'>{t('academico.config.title')}</h3>
              <span className='text-muted fs-7'>{t('academico.config.subtitle')}</span>
            </div>
            <div className='d-flex flex-column'>
              <label className='fs-8 fw-semibold text-muted mb-1'>
                {t('academico.config.yearLabel')}
              </label>
              <select
                className='form-select form-select-solid w-md-250px'
                value={anoLectivoId}
                disabled={noYears}
                onChange={(e) => setAnoLectivoId(e.target.value)}
              >
                {anosList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
                {noYears && <option value=''>—</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className='d-flex overflow-auto mb-6'>
          <ul className='nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-semibold flex-nowrap'>
            {tabs.map((tb) => (
              <li className='nav-item' key={tb.key}>
                <button
                  type='button'
                  className={`nav-link btn btn-link text-nowrap ${
                    tab === tb.key ? 'active' : ''
                  }`}
                  onClick={() => setTab(tb.key)}
                >
                  {tb.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Aviso: los bloques por ano requieren al menos un ano lectivo */}
        {yearScoped && noYears && (
          <div className='alert alert-warning d-flex align-items-center'>
            <i className='ki-duotone ki-information fs-2 text-warning me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{t('academico.config.noYears')}</span>
          </div>
        )}

        {/* Contenido por tab */}
        {tab === 'datos' && <DatosInstitucionalesCard />}
        {tab === 'sedes' && <SedesConfigTab />}

        {tab !== 'datos' && !noYears && anoLectivoId && (
          <>
            {yearScoped && (
              <div className='text-muted fs-7 mb-4'>{t('academico.config.yearHelp')}</div>
            )}
            {tab === 'escala' && <EscalasCard anoLectivoId={anoLectivoId} />}
            {tab === 'metodo' && <MetodosAprobacionCard anoLectivoId={anoLectivoId} />}
            {tab === 'modelo' && <ModelosPedagogicosCard anoLectivoId={anoLectivoId} />}
          </>
        )}
      </Content>
    </>
  )
}

export default ConfiguracionColegioPage
