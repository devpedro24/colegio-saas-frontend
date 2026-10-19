import {useCallback, useEffect, useState} from 'react'
import {useSearchParams, useNavigate} from 'react-router-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import {AcademicPageHeader} from '@/app/shared/components/AcademicPageHeader'
import {AcademicOptionSelect} from '../../shared/AcademicOptionSelect'
import {useCatalogoEvaluacion, useGuardarResultadoManualAnual, useManualAnnualSheet, type ManualAnnualSheet} from '../evaluacion.api'
import {gradeDecimal, validGrade} from '../gradeDecimal'

type Student = ManualAnnualSheet['matriculas'][number]

export const ManualAnnualView = () => {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast(); const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const year = params.get('ano') ?? ''
  const group = params.get('grupo') ?? ''
  const scope: 'materia' | 'area' = params.get('ambito') === 'area' ? 'area' : 'materia'
  const resource = params.get('recurso') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const catalog = useCatalogoEvaluacion({view: 'planillas', yearId: year})
  const sheet = useManualAnnualSheet(group, scope, resource, page)
  const save = useGuardarResultadoManualAnual()
  const [editor, setEditor] = useState<Student | null>(null)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const change = useCallback((values: Record<string, string>) => setParams(previous => {
    const next = new URLSearchParams(previous)
    for (const [key, val] of Object.entries(values)) {
      if (val) next.set(key, val)
      else next.delete(key)
    }
    return next
  }), [setParams])

  useEffect(() => {
    if (!year && catalog.data?.anos.length) {
      change({ano: (catalog.data.anos.find(item => item.estado === 'en_curso') ?? catalog.data.anos[0]).url_token})
    }
  }, [year, catalog.data?.anos, change])

  const years = catalog.data?.anos ?? []
  const groups = (catalog.data?.grupos ?? []).filter(item => item.ano_lectivo_id === year)
  const data = sheet.data
  const visual = data?.escala_visual.tipo === 'imagenes'
  const open = (student: Student) => {
    setEditor(student)
    setValue(visual ? student.resultado.valoracion?.url_token ?? '' : student.resultado.display_value ?? '')
    setReason('')
    save.reset()
  }
  const commit = (annul: boolean) => {
    if (!editor || !data?.recurso_token) return
    save.mutate({group, enrollment: editor.url_token, scope, resource: data.recurso_token,
      valor: annul || visual ? null : gradeDecimal(value),
      escalaOpcionToken: annul || !visual ? null : value,
      motivo: reason.trim(), version: editor.resultado.manual_version ?? 0}, {
      onSuccess: () => {toast.success(t('grading.saved')); setEditor(null)},
      onError: error => toast.error(error.message),
    })
  }

  if (catalog.isLoading) return <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
  if (catalog.error || !catalog.data) return <div className='alert alert-danger' role='alert'>{catalog.error?.message ?? t('common.error')}</div>
  if (!catalog.data.can_manage_manual_annuals) return <div className='alert alert-danger' role='alert'>{t('grading.manualAnnualDenied')}</div>

  return <div className='d-flex flex-column gap-6'>
    <AcademicPageHeader title={t('grading.manualAnnualTitle')} description={t('grading.manualAnnualHelp')}>
      <button type='button' className='btn btn-light-primary' onClick={() => navigate('/evaluacion/catalogo')}>{t('grading.cancel')}</button>
    </AcademicPageHeader>
    <div className='card'><div className='card-body row g-4'>
      <div className='col-12 col-md-3'><label className='form-label' htmlFor='annual-year'>{t('academico.config.yearLabel')}</label>
        <select id='annual-year' className='form-select' value={year} onChange={e => change({ano: e.target.value, grupo: '', ambito: 'materia', recurso: '', page: ''})}>
          <option value=''>{t('academico.config.yearLabel')}</option>{years.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
        </select></div>
      <div className='col-12 col-md-3'><AcademicOptionSelect tipo='grupos' yearId={year} opaque label={t('evaluacion.matriculas.grupo')}
        value={group} onChange={token => change({grupo: token, recurso: '', page: ''})} initialOptions={groups}
        emptyLabel={t('academic.filter.selectGroup')} selectOnly formatOption={option => `${option.grado?.nombre ?? ''} / ${option.nombre ?? ''}`} /></div>
      <div className='col-12 col-md-3'><label className='form-label' htmlFor='annual-scope'>{t('grading.manualAnnualScope')}</label>
        <select id='annual-scope' className='form-select' value={scope} onChange={e => change({ambito: e.target.value, recurso: '', page: ''})}>
          <option value='materia'>{t('siee.materia')}</option><option value='area' disabled={!years.find(item => item.url_token === year)?.anual_areas}>{t('siee.area')}</option>
        </select></div>
      <div className='col-12 col-md-3'><label className='form-label' htmlFor='annual-resource'>{scope === 'area' ? t('siee.area') : t('siee.materia')}</label>
        <select id='annual-resource' className='form-select' value={data?.recurso_token ?? ''} disabled={!data?.recursos.length}
          onChange={e => change({recurso: e.target.value, page: ''})}>
          {!data?.recursos.length && <option value=''>{t('grading.manualAnnualNoCurriculum')}</option>}
          {(data?.recursos ?? []).map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
        </select></div>
    </div></div>
    {!group ? <div className='card card-body text-muted'>{t('grading.manualAnnualSelect')}</div>
      : sheet.isLoading ? <div className='card card-body' role='status'>{t('common.pleaseWait')}</div>
      : sheet.error || !data ? <div className='alert alert-danger' role='alert'>{sheet.error?.message ?? t('common.error')}</div>
      : <div className='card'><div className='card-header'><h3 className='card-title'>{data.grupo.nombre} · {data.recursos.find(item => item.url_token === data.recurso_token)?.nombre ?? ''}</h3></div>
        <div className='card-body'>
          {!data.editable && <div className='alert alert-warning' role='status'>{t('grading.manualAnnualClosed')}</div>}
          <div className='table-responsive'><table className='table table-row-dashed align-middle gy-4'>
            <thead><tr className='text-muted fw-bold'><th>{t('evaluacion.matriculas.estudiante')}</th><th>{t('grading.manualAnnualResult')}</th><th className='text-end'>{t('evaluacion.catalogo.acciones')}</th></tr></thead>
            <tbody>{data.matriculas.map(student => <tr key={student.url_token}>
              <td>{student.nombre_lista}</td>
              <td>{student.resultado.estado === 'calculado'
                ? (visual ? student.resultado.valoracion?.nombre : student.resultado.display_value) : t('grading.pending')}</td>
              <td className='text-end'><button className='btn btn-sm btn-light-primary' disabled={!data.editable || !data.recurso_token} onClick={() => open(student)}>{t('grading.manualAreaEdit')}</button></td>
            </tr>)}
            {!data.matriculas.length && <tr><td colSpan={3} className='text-center text-muted'>{t('grading.manualAreaEmpty')}</td></tr>}</tbody>
          </table></div>
          {data.pagination.last_page > 1 && <div className='d-flex justify-content-between align-items-center mt-4'>
            <span>{data.pagination.page} / {data.pagination.last_page} · {data.pagination.total}</span>
            <div className='d-flex gap-2'><button className='btn btn-light btn-sm' disabled={page <= 1} onClick={() => change({page: String(page - 1)})}>‹</button>
              <button className='btn btn-light btn-sm' disabled={page >= data.pagination.last_page} onClick={() => change({page: String(page + 1)})}>›</button></div>
          </div>}
        </div></div>}
    <Modal show={!!editor} onHide={() => {if (!save.isPending) setEditor(null)}} centered>
      <Modal.Header closeButton><Modal.Title>{t('grading.manualAnnualResult')}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className='fw-semibold'>{editor?.nombre_lista}</p>
        <label className='form-label required' htmlFor='manual-annual-value'>{t('grading.manualAnnualResult')}</label>
        {visual ? <select id='manual-annual-value' className='form-select mb-4' value={value} onChange={e => setValue(e.target.value)}>
          <option value=''>{t('grading.pending')}</option>{data?.escala_visual.opciones.map(item => <option key={item.url_token} value={item.url_token}>{item.nombre}</option>)}
        </select> : <><input id='manual-annual-value' className='form-control mb-2' inputMode='decimal' value={value}
          onChange={e => setValue(e.target.value.replace(',', '.'))} /><small className='d-block text-muted mb-4'>{data?.valor_min} – {data?.valor_max}</small></>}
        <label className='form-label required' htmlFor='manual-annual-reason'>{t('grading.manualReason')}</label>
        <textarea id='manual-annual-reason' className='form-control' rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} />
        {save.error && <div className='alert alert-danger mt-4' role='alert'>{save.error.message}</div>}
      </Modal.Body>
      <Modal.Footer className='justify-content-between'>
        <div>{editor?.resultado.estado === 'calculado' && <button className='btn btn-light-danger' disabled={save.isPending || reason.trim().length < 10}
          onClick={() => commit(true)}>{t('grading.manualComponentAnnul')}</button>}</div>
        <div className='d-flex gap-2'><button className='btn btn-light' disabled={save.isPending} onClick={() => setEditor(null)}>{t('grading.cancel')}</button>
          <button className='btn btn-primary' disabled={save.isPending || reason.trim().length < 10 ||
            (visual ? !data?.escala_visual.opciones.some(item => item.url_token === value)
              : !data || !value.trim() || !validGrade(gradeDecimal(value), data.valor_min, data.valor_max))}
            onClick={() => commit(false)}>{t('grading.save')}</button></div>
      </Modal.Footer>
    </Modal>
  </div>
}
