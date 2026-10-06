import {useEffect, useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAttendancePolicy, useSaveAttendancePolicy} from './asistencia.api'

export function AttendancePolicySettings({year, yearName, readOnly}: {year: string; yearName: string; readOnly: boolean}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})

  return <section className='px-2 py-2'>
    <p className='text-muted mb-3'>{t('attendance.policyYear')}: {yearName}</p>
    <AttendancePolicyPanel key={year} year={year} readOnly={readOnly} />
  </section>
}

function AttendancePolicyPanel({year, readOnly}: {year: string; readOnly: boolean}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const query = useAttendancePolicy(year)
  const save = useSaveAttendancePolicy(year)
  const [count, setCount] = useState('')
  const [percent, setPercent] = useState('')
  const [combination, setCombination] = useState<'cualquiera' | 'ambos'>('cualquiera')
  const [scope, setScope] = useState<'periodo' | 'anual'>('periodo')
  const [late, setLate] = useState('0')
  const [dirty, setDirty] = useState(false)
  const [draftVersion, setDraftVersion] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!query.data || dirty) return
    setCount(query.data.max_faltas == null ? '' : String(query.data.max_faltas))
    setPercent(query.data.max_porcentaje == null ? '' : String(query.data.max_porcentaje))
    setCombination(query.data.combinacion)
    setScope(query.data.ambito)
    setLate(String(query.data.tardes_por_falta))
  }, [query.data, dirty])

  const markDirty = () => {if (!dirty) setDraftVersion(query.data?.version ?? 0); setDirty(true)}
  const update = (setter: (value: string) => void, value: string) => {setter(value); markDirty()}
  const stale = dirty && draftVersion !== query.data?.version
  const valid = (count === '' || (/^\d+$/.test(count) && Number(count) <= 1000)) &&
    (percent === '' || (/^\d+(\.\d{0,2})?$/.test(percent) && Number(percent) <= 100)) &&
    /^\d+$/.test(late) && Number(late) <= 100

  return <div>
    <h3 className='fs-5 fw-bold'>{t('attendance.policyTitle')}</h3>
    <div className='alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-3' role='note'>
      <span>{t('attendance.policyGuidePrompt')}</span>
      <button type='button' className='btn btn-sm btn-light' onClick={() => setHelpOpen(true)}
        aria-haspopup='dialog'>{t('attendance.policyGuideOpen')}</button>
    </div>
    <p className='text-muted'>{t('attendance.policyHelp')}{readOnly ? ` ${t('attendance.closedYear')}` : ''}</p>
    <Modal show={helpOpen} onHide={() => setHelpOpen(false)} centered scrollable size='lg'
      aria-labelledby='attendance-policy-guide-title'>
      <Modal.Header closeButton>
        <Modal.Title id='attendance-policy-guide-title'>{t('attendance.policyGuideTitle')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {(['count', 'percent', 'combination', 'scope', 'late', 'excused', 'example', 'effect'] as const).map(section =>
          <section key={section} className='mb-5'>
            <h4 className='fs-6 fw-bold mb-2'>{t(`attendance.policyGuide.${section}.title`)}</h4>
            <p className='mb-0 text-muted'>{t(`attendance.policyGuide.${section}.body`)}</p>
          </section>)}
      </Modal.Body>
      <Modal.Footer><button type='button' className='btn btn-primary' onClick={() => setHelpOpen(false)}>
        {t('attendance.policyGuideClose')}
      </button></Modal.Footer>
    </Modal>
    {query.isError && <div role='alert' className='alert alert-danger'>{t('attendance.policyLoadError')}</div>}
    {query.data && <>
      {stale && <div role='alert' className='alert alert-warning d-flex justify-content-between align-items-center gap-3'>
        <span>{t('attendance.policyStale')}</span>
        <button type='button' className='btn btn-sm btn-light' onClick={() => {setDirty(false); setDraftVersion(null)}}>{t('attendance.reload')}</button>
      </div>}
      <div className='row g-3'>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-max-count'>{t('attendance.maxCount')}</label>
          <input id='attendance-max-count' type='number' min='0' max='1000' className='form-control' value={count}
            onChange={event => update(setCount, event.target.value)} /></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-max-percent'>{t('attendance.maxPercent')}</label>
          <input id='attendance-max-percent' type='number' min='0' max='100' step='0.01' className='form-control' value={percent}
            onChange={event => update(setPercent, event.target.value)} /></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-combination'>{t('attendance.combination')}</label>
          <select id='attendance-combination' className='form-select' value={combination}
            onChange={event => {setCombination(event.target.value as 'cualquiera' | 'ambos'); markDirty()}}>
            <option value='cualquiera'>{t('attendance.anyThreshold')}</option>
            <option value='ambos'>{t('attendance.bothThresholds')}</option>
          </select></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-scope'>{t('attendance.scope')}</label>
          <select id='attendance-scope' className='form-select' value={scope}
            onChange={event => {setScope(event.target.value as 'periodo' | 'anual'); markDirty()}}>
            <option value='periodo'>{t('attendance.period')}</option>
            <option value='anual'>{t('attendance.year')}</option>
          </select></div>
        <div className='col-md-3'><label className='form-label' htmlFor='attendance-late'>{t('attendance.lateEquivalent')}</label>
          <input id='attendance-late' type='number' min='0' max='100' className='form-control' value={late}
            onChange={event => update(setLate, event.target.value)} /></div>
      </div>
      <div className='d-flex justify-content-end mt-4'>
        <button type='button' className='btn btn-primary' disabled={readOnly || !dirty || stale || !valid || save.isPending}
          onClick={() => save.mutate({
            max_faltas: count === '' ? null : Number(count), max_porcentaje: percent === '' ? null : percent,
            combinacion: combination, ambito: scope, tardes_por_falta: Number(late), version: draftVersion ?? query.data!.version,
          }, {
            onSuccess: () => {setDirty(false); setDraftVersion(null); toast.success(t('attendance.policySaved'))},
            onError: error => toast.error(error instanceof ApiError ? error.message : t('attendance.policySaveError')),
          })}>{t('attendance.savePolicy')}</button>
      </div>
    </>}
  </div>
}
