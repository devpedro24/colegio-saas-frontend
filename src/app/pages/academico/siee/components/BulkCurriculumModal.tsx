import {useEffect, useRef, useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {KTIcon} from '@/_metronic/helpers'
import {useToast} from '@/lib/ui/toast'
import {useBulkCurriculumCatalog, useSaveBulkCurriculum} from '../siee.api'
import {gradeDecimal} from '../../evaluacion/gradeDecimal'
import type {SieeGrade, SieeSubject} from '../siee.types'

type Matrix = Record<string, Record<string, string>>
const compatible = (grade: SieeGrade, subject: SieeSubject) => subject.nivel_token == null || subject.nivel_token === grade.nivel_token
const validWeight = (value: string) => /^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/.test(value)

export function BulkCurriculumModal({year, weighted, mode, editable, close}: {year: string; weighted: boolean; mode: 'add' | 'current'; editable: boolean; close: () => void}) {
  const intl = useIntl(); const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const catalog = useBulkCurriculumCatalog(year)
  const save = useSaveBulkCurriculum(year)
  const [selected, setSelected] = useState<string[]>([])
  const [matrix, setMatrix] = useState<Matrix>({})
  const [dirty, setDirty] = useState(false)
  const initialized = useRef(false)
  const grades = catalog.data?.grades ?? []
  const subjects = catalog.data?.subjects ?? []
  const existing = new Map((catalog.data?.curriculum ?? []).map(row => [`${row.grado_token}:${row.materia_token}`, row]))
  useEffect(() => {
    if (mode !== 'current' || !catalog.data || initialized.current) return
    initialized.current = true
    setSelected(catalog.data.grades.map(grade => grade.url_token))
    setMatrix(Object.fromEntries(catalog.data.grades.map(grade => [grade.url_token,
      Object.fromEntries(catalog.data.curriculum.filter(row => row.grado_token === grade.url_token)
        .map(row => [row.materia_token, gradeDecimal(row.peso_area)]))])))
  }, [mode, catalog.data])
  const chosen = grades.filter(grade => selected.includes(grade.url_token))
  const common = chosen.length ? subjects.filter(subject => chosen.every(grade => compatible(grade, subject))) : []
  const chooseGrades = (tokens: string[]) => {
    setSelected(tokens)
    setMatrix(previous => {
      const next = {...previous}
      for (const token of tokens) if (!next[token]) {
        next[token] = Object.fromEntries((catalog.data?.curriculum ?? []).filter(row => row.grado_token === token)
          .map(row => [row.materia_token, gradeDecimal(row.peso_area)]))
      }
      return next
    })
  }
  const toggleSubjects = (gradeTokens: string[], selections: SieeSubject[], checked: boolean) => {
    setDirty(true)
    setMatrix(previous => {
      const next = {...previous}
      for (const token of gradeTokens) {
        next[token] = {...next[token]}
        for (const subject of selections) {
          if (checked) next[token][subject.url_token] ??= ''
          else if (!existing.has(`${token}:${subject.url_token}`)) delete next[token][subject.url_token]
        }
      }
      return next
    })
  }
  const items = chosen.flatMap(grade => subjects.filter(subject => compatible(grade, subject) && subject.url_token in (matrix[grade.url_token] ?? {}))
    .map(subject => ({grado_token: grade.url_token, materia_token: subject.url_token, peso_area: weighted ? gradeDecimal(matrix[grade.url_token][subject.url_token]) : null}))
    .filter(item => {const previous = existing.get(`${item.grado_token}:${item.materia_token}`)
      return !previous || (weighted && gradeDecimal(previous.peso_area) !== gradeDecimal(item.peso_area))}))
  const invalid = !items.length || items.length > 2000 || (weighted && items.some(item => !validWeight(item.peso_area ?? '')))
  const onClose = () => {if (!save.isPending && (!dirty || window.confirm(t('grading.unsaved')))) close()}

  return <Modal show onHide={onClose} size='xl' centered scrollable className='curriculum-bulk-modal'>
    <Modal.Header closeButton><Modal.Title>{t(mode === 'current' ? 'curriculum.bulk.current' : 'curriculum.bulk.title')}</Modal.Title></Modal.Header>
    <Modal.Body>
      <p className='text-muted'>{t(mode === 'current' ? 'curriculum.bulk.currentHelp' : 'curriculum.bulk.help')}</p>
      {catalog.isPending && <p role='status'>{t('common.loading')}</p>}
      {catalog.error && <div className='alert alert-danger' role='alert'>{catalog.error.message}</div>}
      {save.error && <div className='alert alert-danger' role='alert'>{save.error.message}</div>}
      {!catalog.isPending && !catalog.error && <fieldset disabled={save.isPending || !editable}>
        <div className='d-flex flex-wrap gap-3 justify-content-between align-items-center mb-3'>
          <h4 className='fs-5 required mb-0'>{t('curriculum.bulk.grades')}</h4>
          <button type='button' className='btn btn-sm btn-light-primary' onClick={() => chooseGrades(selected.length === grades.length ? [] : grades.map(grade => grade.url_token))}>{t(selected.length === grades.length ? 'curriculum.bulk.clearGrades' : 'curriculum.bulk.allGrades')}</button>
        </div>
        <div className='row g-3 mb-6'>{grades.map(grade => <div className='col-12 col-sm-6 col-lg-4' key={grade.url_token}>
          <label className={`d-flex align-items-center gap-3 border rounded p-3 h-100 ${selected.includes(grade.url_token) ? 'border-primary bg-light-primary' : ''}`}>
            <input type='checkbox' className='form-check-input flex-shrink-0' checked={selected.includes(grade.url_token)}
              onChange={e => chooseGrades(e.target.checked ? [...selected, grade.url_token] : selected.filter(token => token !== grade.url_token))} />
            <span>{grade.nombre}</span>
          </label>
        </div>)}</div>
        {!grades.length && <p className='text-muted'>{t('siee.no_curriculo')}</p>}
        {chosen.length > 1 && <section className='border rounded p-4 mb-5'>
          <div className='d-flex flex-wrap gap-3 justify-content-between align-items-center mb-3'>
            <h4 className='fs-5 mb-0'>{t('curriculum.bulk.common')}</h4>
            <button type='button' className='btn btn-sm btn-light-primary' disabled={!common.length} onClick={() => toggleSubjects(selected, common, true)}>{t('curriculum.bulk.allCommon')}</button>
          </div>
          <p className='text-muted fs-7'>{t('curriculum.bulk.commonHelp')}</p>
          <div className='row g-3'>{common.map(subject => <label className='col-12 col-md-6 d-flex gap-3 align-items-center' key={subject.url_token}>
            <input type='checkbox' className='form-check-input flex-shrink-0' disabled={chosen.every(grade => existing.has(`${grade.url_token}:${subject.url_token}`))} checked={chosen.every(grade => subject.url_token in (matrix[grade.url_token] ?? {}))}
              onChange={e => toggleSubjects(selected, [subject], e.target.checked)} />{subject.nombre}
          </label>)}</div>
          {!common.length && <p className='text-muted mb-0'>{t('curriculum.bulk.noCommon')}</p>}
        </section>}
        <div className='vstack gap-4'>{chosen.map(grade => {
          const eligible = subjects.filter(subject => compatible(grade, subject))
          const rows = matrix[grade.url_token] ?? {}
          const totals = new Map<string, number>()
          for (const subject of eligible.filter(subject => subject.url_token in rows)) {
            const name = subject.area?.nombre ?? '—'
            totals.set(name, (totals.get(name) ?? 0) + Math.round(Number(rows[subject.url_token] || 0) * 10000))
          }
          return <details key={grade.url_token} className='border rounded p-4' open>
            <summary className='fw-bold fs-5 mb-3'>{grade.nombre} <span className='badge badge-light-primary ms-2'>{eligible.filter(subject => subject.url_token in rows).length}</span></summary>
            <div className='d-flex flex-wrap gap-3 mb-4'>
              <button type='button' className='btn btn-sm btn-light-primary' onClick={() => toggleSubjects([grade.url_token], eligible, true)}>{t('curriculum.bulk.allSubjects')}</button>
              <button type='button' className='btn btn-sm btn-light' onClick={() => toggleSubjects([grade.url_token], eligible, false)}>{t('curriculum.bulk.clearSelection')}</button>
            </div>
            <div className='row g-3'>{eligible.map(subject => {
              const checked = subject.url_token in rows
              return <div className='col-12 col-md-6' key={subject.url_token}>
                <div className='border rounded p-3 h-100 d-flex flex-wrap gap-3 align-items-center'>
                  <label className='d-flex align-items-center gap-3 flex-grow-1 mb-0' style={{minWidth: 0}}>
                    <input className='form-check-input flex-shrink-0' type='checkbox' checked={checked} disabled={existing.has(`${grade.url_token}:${subject.url_token}`)} onChange={e => toggleSubjects([grade.url_token], [subject], e.target.checked)} />
                    <span className='text-break'>{subject.nombre}<small className='d-block text-muted'>{subject.area?.nombre ?? '—'}</small></span>
                  </label>
                  {weighted && <label className='mb-0'><span className='d-block fs-8 required'>{t('siee.peso_area')}</span>
                    <input className='form-control form-control-sm w-100px' inputMode='decimal' disabled={!checked}
                      aria-label={`${grade.nombre} · ${subject.nombre} · ${t('siee.peso_area')}`} value={rows[subject.url_token] ?? ''}
                      onChange={e => {const value = e.target.value.replace(',', '.'); setDirty(true); setMatrix(previous => ({...previous, [grade.url_token]: {...previous[grade.url_token], [subject.url_token]: value}}))}} />
                  </label>}
                </div>
              </div>
            })}</div>
            {!eligible.length && <p className='text-muted'>{t('curriculum.bulk.noSubjects')}</p>}
            {weighted && <div className='d-flex flex-wrap gap-3 mt-3'>{[...totals].map(([area, units]) => <span key={area} className={`badge badge-light-${units === 1000000 ? 'success' : 'warning'}`}>{area}: {Number((units / 10000).toFixed(4))}% / 100%</span>)}</div>}
          </details>
        })}</div>
        <p className='text-muted fs-7 mt-5 mb-0'>{t('curriculum.bulk.preserve')}</p>
        {weighted && <p className='text-muted fs-7 mt-2 mb-0'>{t('curriculum.bulk.weights')}</p>}
      </fieldset>}
    </Modal.Body>
    <Modal.Footer className='justify-content-between gap-3'>
      <span className='text-muted fs-7'>{intl.formatMessage({id: 'curriculum.bulk.count'}, {count: items.length})}</span>
      <div className='d-flex gap-3'><button className='btn btn-light' onClick={onClose} disabled={save.isPending}>{t('common.cancel')}</button>
        {editable && <button className='btn btn-primary' disabled={invalid || save.isPending || catalog.isFetching || !!catalog.error}
          onClick={() => save.mutate(items, {onSuccess: () => {toast.success(t('siee.curriculo_saved')); close()}})}>
          <KTIcon iconName='check' className='fs-4' />{t(save.isPending ? 'siee.guardando' : mode === 'current' ? 'curriculum.bulk.update' : 'curriculum.bulk.save')}
        </button>}</div>
    </Modal.Footer>
  </Modal>
}
