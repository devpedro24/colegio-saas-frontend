import {useEffect, useState} from 'react'
import {useIntl} from 'react-intl'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'
import {usePeriodos} from '../../anos-lectivos/anos-lectivos.api'
import type {CurriculoItem} from '../siee.types'
import {useGuardarPreparacionEvaluacion, usePreparacionEvaluacion} from '../siee.api'
import type {ComponentePreparado, PreparacionSeleccion} from '../siee.api'

type Props = {
  yearToken: string
  curriculum: CurriculoItem
  subjectMode: string
  onDirtyChange: (dirty: boolean) => void
}

export function PreparacionEvaluacionPanel({yearToken, curriculum, subjectMode, onDirtyChange}: Props) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const periods = usePeriodos(yearToken)
  const [periodToken, setPeriodToken] = useState('')
  const [draft, setDraft] = useState<ComponentePreparado[]>([])
  const [dirty, setDirty] = useState(false)
  const period = periods.data?.data.find(item => item.url_token === periodToken)
  const selection: PreparacionSeleccion | null = periodToken ? {
    grado_token: curriculum.grado_token,
    materia_token: curriculum.materia_token,
    periodo_token: periodToken,
  } : null
  const preparation = usePreparacionEvaluacion(yearToken, selection)
  const save = useGuardarPreparacionEvaluacion(yearToken)
  const details = preparation.data
  const canEdit = !!details?.editable && !details.aplicada

  useEffect(() => {
    if (!periodToken && periods.data?.data.length) setPeriodToken(periods.data.data[0].url_token)
  }, [periodToken, periods.data])
  useEffect(() => {
    if (details && !dirty) setDraft(details.componentes)
  }, [details, dirty])
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const change = (next: ComponentePreparado[]) => { setDraft(next); setDirty(true) }
  const updateComponent = (index: number, update: Partial<ComponentePreparado>) => change(draft.map((item, position) =>
    position === index ? {...item, ...update} : item))
  const updateActivity = (componentIndex: number, activityIndex: number,
    update: Partial<ComponentePreparado['actividades'][number]>) => {
    updateComponent(componentIndex, {actividades: draft[componentIndex].actividades.map((item, position) =>
      position === activityIndex ? {...item, ...update} : item)})
  }
  const saveDraft = () => {
    if (!selection || !details) return
    save.mutate({...selection, version: details.version, componentes: draft}, {
      onSuccess: (result) => {
        setDraft(result.componentes)
        setDirty(false)
        toast.success(t('siee.preparacion.saved'))
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return <KTCard>
    <div className='card-header border-0 pt-5'>
      <h3 className='card-title align-items-start flex-column'>
        <span className='card-label fw-bold fs-3 mb-1'>{t('siee.preparacion.title')}</span>
        <span className='text-muted fs-7'>{t('siee.preparacion.help')}</span>
      </h3>
    </div>
    <KTCardBody>
      <p className='fw-semibold mb-4'>{curriculum.grado_nombre} / {curriculum.materia_nombre}</p>
      <label className='form-label required' htmlFor='preparacion-periodo'>{t('siee.preparacion.periodo')}</label>
      <select id='preparacion-periodo' className='form-select form-select-solid mb-5'
        value={periodToken} onChange={event => {
          if (dirty && !window.confirm(t('siee.preparacion.unsaved'))) return
          setDirty(false)
          setPeriodToken(event.target.value)
        }}>
        {(periods.data?.data ?? []).map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
      </select>
      {periods.isPending && <div role='status'>{t('common.loading')}</div>}
      {!periods.isPending && !periods.data?.data.length && <div className='alert alert-info'>{t('siee.preparacion.noPeriods')}</div>}
      {periods.error && <div className='alert alert-danger' role='alert'>{periods.error.message}</div>}
      {preparation.isPending && periodToken && <div role='status'>{t('common.loading')}</div>}
      {preparation.error && <div className='alert alert-danger' role='alert'>{preparation.error.message}</div>}
      {details && <>
        {details.aplicada && <div className='alert alert-info'>{t('siee.preparacion.applied')}</div>}
        {!details.editable && <div className='alert alert-info'>{t('siee.preparacion.closed')}</div>}
        {details.bloqueos.length > 0 && <div className='alert alert-warning' role='status'>
          <div className='fw-semibold'>{t('siee.preparacion.pending')}</div>
          <ul className='mb-0'>{details.bloqueos.map(code =>
            <li key={code}>{t(`siee.preparacion.issue.${code}`)}</li>)}</ul>
        </div>}
        {draft.map((component, componentIndex) => <div key={componentIndex} className='border rounded p-4 mb-4'>
          <div className='row g-3 align-items-end'>
            <div className='col-md-5'>
              <label className='form-label required' htmlFor={`preparacion-component-${componentIndex}`}>{t('siee.preparacion.name')}</label>
              <input id={`preparacion-component-${componentIndex}`} className='form-control' maxLength={120}
                disabled={!canEdit} value={component.nombre} onChange={event => updateComponent(componentIndex, {nombre: event.target.value})} />
            </div>
            <div className='col-md-3'>
              <label className='form-label required' htmlFor={`preparacion-mode-${componentIndex}`}>{t('siee.preparacion.mode')}</label>
              <select id={`preparacion-mode-${componentIndex}`} className='form-select' disabled={!canEdit}
                value={component.modo} onChange={event => updateComponent(componentIndex,
                  {modo: event.target.value as ComponentePreparado['modo']})}>
                <option value='SIMPLE_AVERAGE'>{t('evaluacion.planilla.promedio_simple')}</option>
                <option value='WEIGHTED_AVERAGE'>{t('evaluacion.planilla.promedio_ponderado')}</option>
              </select>
            </div>
            <div className='col-md-2'>
              <label className={`form-label ${subjectMode === 'WEIGHTED_AVERAGE' ? 'required' : ''}`}
                htmlFor={`preparacion-weight-${componentIndex}`}>{t('siee.preparacion.weight')}
                {subjectMode !== 'WEIGHTED_AVERAGE' && <> {t('common.field.optional')}</>}</label>
              <input id={`preparacion-weight-${componentIndex}`} className='form-control' type='number' min='0' max='100' step='0.0001'
                disabled={!canEdit} value={component.peso ?? ''}
                onChange={event => updateComponent(componentIndex, {peso: event.target.value || null})} />
            </div>
            <div className='col-md-2'>
              <button type='button' className='btn btn-sm btn-light-danger w-100' disabled={!canEdit}
                onClick={() => change(draft.filter((_, index) => index !== componentIndex))}>{t('siee.preparacion.remove')}</button>
            </div>
          </div>
          <div className='mt-4'>
            <div className='fw-semibold mb-2'>{t('siee.preparacion.activities')}</div>
            {component.actividades.map((activity, activityIndex) => <div key={activityIndex} className='row g-2 mb-2 align-items-end'>
              <div className='col-md-5'>
                <label className='form-label required' htmlFor={`activity-name-${componentIndex}-${activityIndex}`}>{t('siee.preparacion.name')}</label>
                <input id={`activity-name-${componentIndex}-${activityIndex}`} className='form-control form-control-sm' maxLength={160}
                  disabled={!canEdit} value={activity.nombre}
                  onChange={event => updateActivity(componentIndex, activityIndex, {nombre: event.target.value})} />
              </div>
              <div className='col-md-3'>
                <label className='form-label required' htmlFor={`activity-date-${componentIndex}-${activityIndex}`}>{t('siee.preparacion.date')}</label>
                <input id={`activity-date-${componentIndex}-${activityIndex}`} className='form-control form-control-sm'
                  type='date' min={period?.fecha_inicio} max={period?.fecha_fin} disabled={!canEdit} value={activity.fecha}
                  onChange={event => updateActivity(componentIndex, activityIndex, {fecha: event.target.value})} />
              </div>
              <div className='col-md-2'>
                <label className={`form-label ${component.modo === 'WEIGHTED_AVERAGE' ? 'required' : ''}`}
                  htmlFor={`activity-weight-${componentIndex}-${activityIndex}`}>{t('siee.preparacion.weight')}
                  {component.modo !== 'WEIGHTED_AVERAGE' && <> {t('common.field.optional')}</>}</label>
                <input id={`activity-weight-${componentIndex}-${activityIndex}`} className='form-control form-control-sm'
                  type='number' min='0' max='100' step='0.0001' disabled={!canEdit} value={activity.peso ?? ''}
                  onChange={event => updateActivity(componentIndex, activityIndex, {peso: event.target.value || null})} />
              </div>
              <div className='col-md-2'>
                <button type='button' className='btn btn-sm btn-light-danger w-100' disabled={!canEdit}
                  onClick={() => updateComponent(componentIndex,
                    {actividades: component.actividades.filter((_, index) => index !== activityIndex)})}>
                  {t('siee.preparacion.remove')}
                </button>
              </div>
            </div>)}
            <button type='button' className='btn btn-sm btn-light-primary' disabled={!canEdit}
              onClick={() => updateComponent(componentIndex, {actividades: [...component.actividades,
                {nombre: '', fecha: period?.fecha_inicio ?? '', peso: null}]})}>
              {t('siee.preparacion.addActivity')}
            </button>
          </div>
        </div>)}
        <div className='d-flex flex-wrap gap-3'>
          <button type='button' className='btn btn-light-primary' disabled={!canEdit || draft.length >= 20}
            onClick={() => change([...draft, {nombre: '', modo: 'SIMPLE_AVERAGE', peso: null, actividades: []}])}>
            {t('siee.preparacion.addComponent')}
          </button>
          <button type='button' className='btn btn-primary' disabled={!canEdit || !dirty || save.isPending}
            onClick={saveDraft}>{save.isPending ? t('siee.guardando') : t('siee.preparacion.save')}</button>
        </div>
      </>}
    </KTCardBody>
  </KTCard>
}
