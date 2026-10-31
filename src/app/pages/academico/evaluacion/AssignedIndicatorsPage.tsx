import {useIntl} from 'react-intl'
import {IndicadorWorkspace} from './components/IndicadorWorkspace'
import {GroupIndicatorSheet} from './components/GroupIndicatorSheet'
import {useAssignedIndicatorOptions, useIndicatorPolicy, type IndicatorContext} from './indicadores.api'
import {useAcademicSearchParams} from '../shared/useAcademicSearchParams'

/** Teachers see assigned subjects only; authorized managers see every group. */
export function AssignedIndicatorsPage({fixedYearToken}: {fixedYearToken?: string} = {}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const [params, setParams] = useAcademicSearchParams('indicadores')
  const year = params.get('ano') ?? ''
  const group = params.get('grupo') ?? ''
  const subject = params.get('materia') ?? ''
  const period = params.get('periodo') ?? ''
  const select = (field: string, value: string, clear: string[] = []) => setParams(current => {
    const next = new URLSearchParams(current)
    next.set(field, value)
    clear.forEach(key => next.delete(key))
    return next
  }, {replace: true})
  const catalog = useAssignedIndicatorOptions()
  const selectedYear = catalog.data?.anos.find(item => item.token === (fixedYearToken || year))
    ?? (fixedYearToken ? undefined : catalog.data?.anos.find(item => item.estado === 'en_curso') ?? catalog.data?.anos[0])
  const policy = useIndicatorPolicy(selectedYear?.token ?? '')
  if (catalog.isLoading) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
  if (catalog.isError || !catalog.data) return <div className='alert alert-danger' role='alert'>{catalog.error?.message ?? t('common.error')}</div>
  if (policy.isLoading) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
  if (policy.isError) return <div className='alert alert-danger' role='alert'>{policy.error.message}</div>

  const data = catalog.data
  const groupMode = policy.data?.alcance === 'grupo'
  const groups = data.grupos.filter(item => item.ano_token === selectedYear?.token && item.materias.length > 0)
  const selectedGroup = groups.find(item => item.token === group)
    ?? (groups.length === 1 ? groups[0] : undefined)
  const subjects = selectedGroup?.materias ?? []
  const selectedSubject = subjects.find(item => item.token === subject)
    ?? (subjects.length === 1 ? subjects[0] : undefined)
  const periods = data.periodos.filter(item => item.ano_token === selectedYear?.token)
  const selectedPeriod = periods.find(item => item.token === period)
    ?? periods.find(item => item.estado === 'abierto') ?? periods[0]
  const editLocked = (selectedYear && ['cerrado', 'archivado'].includes(selectedYear.estado))
    || (selectedPeriod && selectedPeriod.estado !== 'abierto')
  const context: IndicatorContext | null = !groupMode && selectedYear && selectedGroup && selectedSubject && selectedPeriod ? {
    year: selectedYear.token, grade: selectedGroup.grado_token, group: selectedGroup.token,
    subject: selectedSubject.token, period: selectedPeriod.token, periodOrder: selectedPeriod.orden,
  } : null

  return <>
    <div className='card mb-6'><div className='card-header'><h3 className='card-title'>{t('indicators.title')}</h3></div>
      <div className='card-body'>
        <p className='text-muted'>{groupMode ? t('indicators.sheet.help') : t('indicators.help')}</p>
        {!groups.length && <div className='alert alert-info' role='status'>{t('indicators.noGroups')}</div>}
        <div className='row g-4'>
          {!fixedYearToken && <div className='col-md-3'><label htmlFor='assigned-indicator-year' className='form-label'>{t('academico.config.yearLabel')}</label>
            <select id='assigned-indicator-year' className='form-select' value={selectedYear?.token ?? ''} onChange={event => {
              select('ano', event.target.value, ['grupo', 'materia', 'periodo'])
            }}>{data.anos.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}</select></div>}
          {groups.length > 1 && <div className='col-md-3'><label htmlFor='assigned-indicator-group' className='form-label'>{t('evaluacion.matriculas.grupo')}</label>
            <select id='assigned-indicator-group' className='form-select' value={selectedGroup?.token ?? ''} onChange={event => {
              select('grupo', event.target.value, ['materia'])
            }}><option value=''>{t('academic.filter.selectGroup')}</option>
              {groups.map(item => <option key={item.token} value={item.token}>{item.grado_nombre} / {item.nombre}</option>)}</select></div>}
          {!groupMode && selectedGroup && <div className='col-md-3'><label htmlFor='assigned-indicator-subject' className='form-label'>{t('siee.materia')}</label>
            <select id='assigned-indicator-subject' className='form-select' value={selectedSubject?.token ?? ''}
              onChange={event => select('materia', event.target.value)} disabled={subjects.length <= 1}>
              {subjects.length > 1 && <option value=''>{t('academic.filter.selectSubject')}</option>}
              {subjects.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}</select></div>}
          <div className='col-md-3'><label htmlFor='assigned-indicator-period' className='form-label'>{t('evaluacion.period')}</label>
            <select id='assigned-indicator-period' className='form-select' value={selectedPeriod?.token ?? ''}
              onChange={event => select('periodo', event.target.value)}>
              {periods.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}</select></div>
        </div>
      </div></div>
    {editLocked && <div className='alert alert-warning' role='status'>{t('indicators.sheet.closed')}</div>}
    {groupMode && selectedGroup && selectedPeriod && <GroupIndicatorSheet key={`${selectedGroup.token}:${selectedPeriod.token}`}
      group={selectedGroup.token} period={selectedPeriod.token} />}
    {context && <IndicadorWorkspace key={`${context.group}:${context.subject}:${context.period}`} context={context} periodState={selectedPeriod.estado} />}
  </>
}
