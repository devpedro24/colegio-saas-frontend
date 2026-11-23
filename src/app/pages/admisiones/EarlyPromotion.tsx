import {useState, type FormEvent} from 'react'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'

type Dossier = {
  token: string; estado: 'recomendada' | 'aprobada' | 'no_aprobada'; origen: string; destino: string
  fecha_consentimiento?: string; consentimiento_nombre?: string; fecha_recomendacion?: string; recomendacion?: string; recomendado_por?: string
  fecha_decision: string | null; decidido_por: string | null; acta_numero: string | null; acta_nombre?: string | null
  constancia?: {numero: string; firmante: string; fecha_expedicion: string; verificable: boolean; con_anexo: boolean} | null
}
export type PromotionData = {
  expedientes: Dossier[]; destinos: {token: string; nombre: string}[]; puede_recomendar: boolean; puede_decidir: boolean
  primer_periodo_abierto: boolean; inicio_periodo: string | null; hoy: string; firmante_previsto?: string | null
}

export function EarlyPromotion({token, data, version, since, maxBytes}: {
  token: string; data: PromotionData; version: number; since: string; maxBytes: number
}) {
  const intl = useIntl()
  const t = (es: string, en: string) => intl.locale.startsWith('en') ? en : es
  const toast = useToast()
  const cache = useQueryClient()
  const [edit, setEdit] = useState<{kind: 'recommend'; version: number} | {kind: 'decide'; dossier: Dossier} | null>(null)
  const [localError, setLocalError] = useState('')
  const base = `/matriculas/${token}/promociones-anticipadas`
  const certificate = useMutation({
    mutationFn: (caseToken: string) => api.post(`${base}/${caseToken}/constancia`, {}),
    onSuccess: async () => {
      await cache.invalidateQueries({queryKey: ['matriculas']})
      toast.success(t('Constancia lista para descargar.', 'Certificate ready for download.'))
    },
  })
  const mutation = useMutation({
    mutationFn: ({path, form}: {path: string; form: FormData}) => api.post(path, form),
    onSuccess: async () => {
      setEdit(null)
      toast.success(t('Expediente de promoción actualizado.', 'Promotion record updated.'), 'updated')
      await Promise.all(['matriculas', 'ingreso', 'evaluacion', 'asistencias', 'boletines', 'aula', 'opciones-academicas']
        .map(key => cache.invalidateQueries({queryKey: [key]})))
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) void cache.invalidateQueries({queryKey: ['matriculas']})
    },
  })
  function open(form: typeof edit) {
    mutation.reset()
    setLocalError('')
    setEdit(form)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!edit || mutation.isPending) return
    const form = new FormData(event.currentTarget)
    const file = form.get(edit.kind === 'recommend' ? 'consentimiento' : 'acta')
    if (!(file instanceof File) || !file.size || file.size > maxBytes || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      setLocalError(t('Adjunta un PDF, JPG o PNG de hasta', 'Attach a PDF, JPG or PNG up to') + ' ' + intl.formatNumber(maxBytes / 1048576) + ' MB.')
      return
    }
    if (edit.kind === 'recommend') {
      if (String(form.get('fecha_consentimiento')) > String(form.get('fecha_recomendacion'))) {
        setLocalError(t('El consentimiento debe ser previo o del mismo día de la recomendación.', 'Consent must be dated on or before the recommendation.'))
        return
      }
      form.set('version', String(edit.version))
    }
    setLocalError('')
    mutation.mutate({path: edit.kind === 'recommend' ? base : base + '/' + edit.dossier.token + '/decision', form})
  }
  const labels = {recomendada: t('Pendiente de decisión', 'Awaiting decision'), aprobada: t('Aprobada', 'Approved'), no_aprobada: t('No aprobada', 'Declined')}
  const pending = data.expedientes.some(row => row.estado === 'recomendada')
  const minDate = [data.inicio_periodo ?? '', since].sort().at(-1)
  return <section className='border rounded p-4 my-4' aria-labelledby='early-title'>
    <div className='d-flex flex-wrap align-items-center justify-content-between gap-2'>
      <h5 id='early-title' className='m-0'>{t('Promoción anticipada', 'Early promotion')}</h5>
      {data.puede_recomendar && data.destinos.length > 0 && !edit && <button type='button' className='btn btn-sm btn-light-primary'
        onClick={() => open({kind: 'recommend', version})}>{t('Registrar recomendación', 'Record recommendation')}</button>}
    </div>
    {!pending && !data.primer_periodo_abierto && <p className='text-muted mt-2 mb-0'>{t('El trámite se realiza durante el primer periodo abierto.', 'The procedure takes place during the open first term.')}</p>}
    {data.puede_recomendar && !data.destinos.length && <p className='text-muted mt-2 mb-0'>{t('No hay un grupo activo del grado siguiente en esta sede.', 'No active group for the next grade is available at this campus.')}</p>}
    {data.expedientes.map(row => <article key={row.token} className='border-top mt-3 pt-3'>
      <div className='d-flex flex-wrap gap-2 align-items-center'><strong>{row.origen} → {row.destino}</strong>
        <span className={`badge ${row.estado === 'aprobada' ? 'badge-light-success' : 'badge-light'}`}>{labels[row.estado]}</span></div>
      {row.consentimiento_nombre && <><div className='mt-2'>{t('Consentimiento familiar', 'Family consent')} · {row.fecha_consentimiento} · <a href={`/api${base}/${row.token}/soportes/consentimiento`} download>{row.consentimiento_nombre}</a></div>
      <div>{t('Consejo Académico', 'Academic Council')} · {row.fecha_recomendacion} · {row.recomendado_por}</div>
      <p className='text-break mb-2' style={{whiteSpace: 'pre-wrap'}}>{row.recomendacion}</p></>}
      {row.fecha_decision && <div>{t('Consejo Directivo', 'Governing Council')} · {row.fecha_decision} · {row.decidido_por} · {t('Acta', 'Minutes')} {row.acta_numero}
        {row.acta_nombre && <> · <a href={`/api${base}/${row.token}/soportes/acta`} download>{row.acta_nombre}</a></>}</div>}
      {row.estado === 'aprobada' && (row.constancia || data.firmante_previsto) && <div className='bg-light rounded p-3 mt-3'>
        {row.constancia ? <>
          <strong>{t('Constancia', 'Certificate')} {row.constancia.numero}</strong>
          <div>{t('Firmante', 'Signatory')} · {row.constancia.firmante} · {row.constancia.fecha_expedicion}</div>
          <div className='d-flex flex-wrap gap-2 mt-2'>
            {row.constancia.con_anexo && <a className='btn btn-sm btn-primary' href={`/api${base}/${row.token}/constancia/pdf-verificable`} download>{t('Descargar constancia con QR', 'Download certificate with QR')}</a>}
            <a className='btn btn-sm btn-light-primary' href={`/api${base}/${row.token}/constancia/pdf`} download>{row.constancia.con_anexo ? t('Descargar original', 'Download original') : t('Descargar constancia PDF', 'Download certificate PDF')}</a>
            {!row.constancia.verificable && data.firmante_previsto && <button type='button' className='btn btn-sm btn-light-primary' disabled={certificate.isPending}
              onClick={() => certificate.mutate(row.token)}>{t('Habilitar verificación', 'Enable verification')}</button>}
          </div>
        </> : <>
          <div>{t('Firmante de la constancia', 'Certificate signatory')} · <strong>{data.firmante_previsto}</strong></div>
          <button className='btn btn-sm btn-light-primary mt-2' type='button' disabled={certificate.isPending} onClick={() => certificate.mutate(row.token)}>
            {t('Emitir constancia PDF', 'Issue certificate PDF')}</button>
        </>}
        {certificate.variables === row.token && certificate.error && <p role='alert' className='text-danger mb-0 mt-2'>{certificate.error.message}</p>}
      </div>}
      {row.estado === 'recomendada' && data.puede_decidir && !edit && <button type='button' className='btn btn-sm btn-light-primary mt-2'
        onClick={() => open({kind: 'decide', dossier: row})}>{t('Registrar decisión', 'Record decision')}</button>}
    </article>)}
    {edit && <form className='mt-4' onSubmit={submit}><fieldset disabled={mutation.isPending}>
      <legend className='fs-6 fw-bold'>{edit.kind === 'recommend' ? t('Recomendación del Consejo Académico', 'Academic Council recommendation') : t('Decisión del Consejo Directivo', 'Governing Council decision')}</legend>
      <div className='row g-3'>{edit.kind === 'recommend' ? <>
        <label className='col-md-6'>{t('Grupo del grado siguiente', 'Group in the next grade')}
          <select name='grupo_token' className='form-select' required defaultValue=''><option value=''>{t('Selecciona un grupo', 'Select a group')}</option>
            {data.destinos.map(g => <option key={g.token} value={g.token}>{g.nombre}</option>)}</select></label>
        <label className='col-md-6'>{t('Fecha del consentimiento familiar', 'Family consent date')}
          <input type='date' className='form-control' name='fecha_consentimiento' max={data.hoy} required /></label>
        <label className='col-md-6'>{t('Consentimiento firmado', 'Signed consent')}
          <input type='file' className='form-control' accept='.pdf,.jpg,.jpeg,.png' name='consentimiento' required /></label>
        <label className='col-md-6'>{t('Fecha de recomendación', 'Recommendation date')}
          <input type='date' className='form-control' name='fecha_recomendacion' defaultValue={data.hoy} min={minDate} max={data.hoy} required /></label>
        <label className='col-12'>{t('Fundamento de la recomendación', 'Basis for recommendation')}
          <textarea name='recomendacion' className='form-control' rows={3} required maxLength={2000}
            placeholder={t('Describe el desempeño cognitivo, personal y social de la estudiante o el estudiante.', 'Describe cognitive, personal and social performance.')} /></label>
      </> : <>
        <label className='col-md-6'>{t('Decisión', 'Decision')}<select name='decision' defaultValue='' className='form-select' required>
          <option value=''>{t('Selecciona la decisión del acta', 'Select the decision in the minutes')}</option>
          {data.primer_periodo_abierto && <option value='aprobada'>{labels.aprobada}</option>}<option value='no_aprobada'>{labels.no_aprobada}</option>
        </select></label>
        <label className='col-md-6'>{t('Fecha del acta', 'Date of minutes')}<input name='fecha_decision' className='form-control' type='date' defaultValue={data.hoy} min={edit.dossier.fecha_recomendacion} max={data.hoy} required /></label>
        <label className='col-md-6'>{t('Número de acta', 'Minutes number')}<input name='acta_numero' className='form-control' maxLength={100} required /></label>
        <label className='col-md-6'>{t('Acta del Consejo Directivo', 'Governing Council minutes')}<input name='acta' className='form-control' type='file' accept='.pdf,.jpg,.jpeg,.png' required /></label>
        <p className='col-12 mb-0'>{t('La aprobación traslada la matrícula a', 'Approval moves the enrollment to')} <strong>{edit.dossier.destino}</strong> {t('desde la fecha del acta. Las notas y asistencias previas conservan su grupo de origen.', 'from the date of the minutes. Earlier grades and attendance retain their original group.')}</p>
      </>}</div>
      {(localError || mutation.error) && <p role='alert' className='text-danger my-2'>{localError || mutation.error?.message}</p>}
      <div className='d-flex justify-content-end gap-2 mt-3'><button type='button' className='btn btn-light btn-sm' onClick={() => open(null)}>{t('Cancelar', 'Cancel')}</button>
        <button type='submit' className='btn btn-primary btn-sm'>{edit.kind === 'recommend' ? t('Guardar recomendación', 'Save recommendation') : t('Guardar decisión', 'Save decision')}</button></div>
    </fieldset></form>}
  </section>
}
