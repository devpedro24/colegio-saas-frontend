import {FC, useEffect, useState} from 'react'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import type {AnoLectivo} from '../anos-lectivos.types'
import {useAprobarPromocion, useGuardarPolitica, usePromociones} from '../promociones.api'
import type {PromocionRegistro, PromocionResumen} from '../promociones.api'

type Props = {ano: AnoLectivo | null; onClose: () => void}

const DecisionRow: FC<{row: PromocionRegistro; summary: PromocionResumen; ano: string}> = ({row, summary, ano}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const approve = useAprobarPromocion(ano)
  const [result, setResult] = useState(row.decision?.vigente
    ? row.decision.resultado : row.propuesta.resultado ?? 'reprobado')
  const [target, setTarget] = useState(row.decision?.vigente ? row.decision.grado_destino_token ?? '' : '')
  const [reason, setReason] = useState(row.decision?.motivo ?? '')
  const calculated = row.propuesta.estado === 'calculada'

  const submit = () => {
    if (!row.propuesta.huella || !reason.trim()) return
    approve.mutate({matricula: row.matricula_token, input: {
      huella: row.propuesta.huella, resultado: result,
      grado_destino_token: result === 'promovido' ? target || null : null,
      motivo: reason.trim(), version: row.decision?.version ?? 0,
    }}, {
      onSuccess: () => toast.success(t('academico.promocion.saved')),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : t('common.toast.genericError')),
    })
  }

  return <div className='border rounded p-4 mb-3'>
    <div className='d-flex justify-content-between gap-3 flex-wrap'>
      <div><strong>{row.estudiante}</strong> · {row.grado} / ({row.grupo})</div>
      {row.decision && <span className={`badge ${row.decision.vigente ? 'badge-light-success' : 'badge-light-warning'}`}>
        {t(row.decision.vigente ? 'academico.promocion.approved' : 'academico.promocion.outdated')}
      </span>}
    </div>
    {!calculated ? <div className='text-muted mt-2'>{row.propuesta.motivos?.join(' · ')}</div> : <>
      <div className='my-2'>
        {t('academico.promocion.proposal')}: <strong>{t(`academico.promocion.result.${row.propuesta.resultado}`)}</strong>
        {' · '}{t('academico.promocion.failed')}: {row.propuesta.numero_reprobadas}
        {' · '}{t('academico.promocion.average')}: {row.propuesta.promedio}
      </div>
      <div className='row g-2'>
        <div className='col-md-4'>
          <label className='form-label'>{t('academico.promocion.decision')} <span className='text-danger'>*</span></label>
          <select className='form-select' value={result} onChange={(event) => {setResult(event.target.value); setTarget('')}}>
            <option value={row.propuesta.resultado}>{t(`academico.promocion.result.${row.propuesta.resultado}`)}</option>
            {row.propuesta.resultado === 'promovido' && <option value='egresado'>{t('academico.promocion.result.egresado')}</option>}
          </select>
        </div>
        {result === 'promovido' && <div className='col-md-4'>
          <label className='form-label'>{t('academico.promocion.target')} <span className='text-danger'>*</span></label>
          <select className='form-select' value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value=''>{t('academico.promocion.selectTarget')}</option>
            {summary.grados.filter((grade) => grade.token !== row.grado_token).map((grade) =>
              <option key={grade.token} value={grade.token}>{grade.nombre}</option>)}
          </select>
        </div>}
        <div className={result === 'promovido' ? 'col-md-4' : 'col-md-8'}>
          <label className='form-label'>{t('academico.promocion.reason')} <span className='text-danger'>*</span></label>
          <input className='form-control' value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} />
        </div>
      </div>
      <button className='btn btn-sm btn-primary mt-3' type='button' disabled={approve.isPending || !reason.trim() || (result === 'promovido' && !target)} onClick={submit}>
        {t('academico.promocion.approve')}
      </button>
    </>}
  </div>
}

export const PromocionesDialog: FC<Props> = ({ano, onClose}) => {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [group, setGroup] = useState('')
  const [maxFailed, setMaxFailed] = useState(0)
  const [minimum, setMinimum] = useState('')
  const [mandatory, setMandatory] = useState<string[]>([])
  const [configuredVersion, setConfiguredVersion] = useState<number | null>(null)
  const summary = usePromociones(ano?.id ?? null, page, group)
  const save = useGuardarPolitica(ano?.id ?? '')

  useEffect(() => {setConfiguredVersion(null); setPage(1); setGroup('')}, [ano?.id])

  useEffect(() => {
    if (!summary.data || !ano) return
    const policy = summary.data.politica
    if (configuredVersion === policy?.version) return
    setMaxFailed(policy?.max_reprobadas ?? 0)
    setMinimum(policy?.promedio_minimo ?? '')
    setMandatory(policy?.materias_obligatorias ?? [])
    setConfiguredVersion(policy?.version ?? 0)
  }, [ano, summary.data, configuredVersion])

  const savePolicy = () => save.mutate({
    max_reprobadas: maxFailed, materias_obligatorias: mandatory,
    promedio_minimo: minimum.trim() || null, version: summary.data?.politica?.version ?? 0,
  }, {
    onSuccess: () => toast.success(t('academico.promocion.policySaved')),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : t('common.toast.genericError')),
  })

  return <Modal show={!!ano} onHide={onClose} size='xl' scrollable centered>
    <Modal.Header closeButton><Modal.Title>{t('academico.promocion.title')} · {ano?.nombre}</Modal.Title></Modal.Header>
    <Modal.Body>
      {summary.isLoading && <div role='status' className='text-muted'>{t('academico.promocion.loading')}</div>}
      {summary.isError && <div role='alert' className='alert alert-danger'>{t('academico.promocion.error')}</div>}
      {summary.data && <>
        <p className='text-muted'>{t('academico.promocion.help')}</p>
        <div className='border rounded p-4 mb-5'>
          <h4>{t('academico.promocion.policy')}</h4>
          <div className='row g-3'>
            <div className='col-md-4'>
              <label className='form-label'>{t('academico.promocion.maxFailed')} <span className='text-danger'>*</span></label>
              <input type='number' min={0} max={12} className='form-control' value={maxFailed} onChange={(e) => setMaxFailed(Number(e.target.value))} />
            </div>
            <div className='col-md-4'>
              <label className='form-label'>{t('academico.promocion.minAverage')} ({t('academico.promocion.optional')})</label>
              <input type='number' step='0.01' className='form-control' value={minimum} onChange={(e) => setMinimum(e.target.value)} />
            </div>
          </div>
          <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap mt-3'>
            <div className='form-label mb-0'>{t('academico.promocion.mandatory')} ({t('academico.promocion.optional')})</div>
            <label className='form-check form-check-inline mb-0'>
              <input className='form-check-input' type='checkbox' aria-label={t('academico.promocion.selectAll')}
                checked={summary.data.materias.length > 0 && summary.data.materias.every(item => mandatory.includes(item.token))}
                onChange={event => setMandatory(event.target.checked ? summary.data!.materias.map(item => item.token) : [])} />
              <span className='form-check-label'>{t('academico.promocion.selectAll')}</span>
            </label>
          </div>
          <div className='table-responsive border rounded mt-3' style={{maxHeight: 260, overflowY: 'auto'}}>
            <table className='table table-row-dashed align-middle mb-0'>
              <thead className='bg-light position-sticky top-0'><tr><th>{t('academico.promocion.subject')}</th><th className='text-center'>{t('academico.promocion.mustPass')}</th></tr></thead>
              <tbody>{summary.data.materias.map(subject => <tr key={subject.token}>
                <td><label htmlFor={`mandatory-${subject.token}`} className='fw-semibold cursor-pointer'>{subject.nombre}</label></td>
                <td className='text-center'><input id={`mandatory-${subject.token}`} type='checkbox' className='form-check-input'
                  checked={mandatory.includes(subject.token)} onChange={event => setMandatory(current => event.target.checked
                    ? [...current, subject.token] : current.filter(token => token !== subject.token))} /></td>
              </tr>)}</tbody>
            </table>
          </div>
          <button className='btn btn-primary btn-sm mt-4' type='button' disabled={save.isPending || maxFailed < 0 || maxFailed > 12} onClick={savePolicy}>
            {t('academico.promocion.savePolicy')}
          </button>
        </div>
        <div className='d-flex justify-content-between align-items-end flex-wrap gap-3 mb-3'>
          <h4 className='mb-0'>{t('academico.promocion.students')} ({summary.data.meta.total})</h4>
          <div><label className='form-label' htmlFor='promotion-group'>{t('academico.promocion.group')}</label>
            <select id='promotion-group' className='form-select' value={group} onChange={event => {setGroup(event.target.value); setPage(1)}}>
              <option value=''>{t('academico.promocion.allGroups')}</option>
              {summary.data.grupos.map(item => <option key={item.token} value={item.token}>{item.nombre}</option>)}
            </select>
          </div>
        </div>
        {summary.data.data.length === 0 && <p className='text-muted'>{t('academico.promocion.empty')}</p>}
        {summary.data.data.map((row) => <DecisionRow key={`${row.matricula_token}-${row.propuesta.huella ?? ''}-${row.decision?.version ?? 0}`}
          row={row} summary={summary.data!} ano={ano!.id} />)}
        {summary.data.meta.last_page > 1 && <div className='d-flex justify-content-between align-items-center'>
          <button className='btn btn-light btn-sm' type='button' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('academico.promocion.previous')}</button>
          <span>{page} / {summary.data.meta.last_page}</span>
          <button className='btn btn-light btn-sm' type='button' disabled={page >= summary.data.meta.last_page} onClick={() => setPage((p) => p + 1)}>{t('academico.promocion.next')}</button>
        </div>}
      </>}
    </Modal.Body>
    <Modal.Footer><button className='btn btn-light' type='button' onClick={onClose}>{t('common.close')}</button></Modal.Footer>
  </Modal>
}
