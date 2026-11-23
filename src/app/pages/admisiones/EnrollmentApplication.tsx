import {useState} from 'react'
import {MailReviewPanel} from '@/app/shared/MailReviewPanel'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import type {Application, ApplicationsPage} from './ingreso.types'
import {getEnrollmentStates} from './ingreso.types'
import {IntakeIcon, IntakeModal, IntakeNotice, IntakePayments} from './IntakeUI'
import {studentName, useIntakeText} from './intakeWorkflow'
import {EnrollmentGradeSummary} from './EnrollmentGradeSummary'

export function EnrollmentApplication({
  application: item,
  groups,
  can,
  busy,
  run,
  update,
  back,
  onMailReview,
}: {
  application: Application
  groups: ApplicationsPage['grupos']
  can: (action: string) => boolean
  busy: boolean
  run: (action: () => Promise<void>) => Promise<void>
  update: (next: Application) => Promise<void>
  onMailReview: () => void
  back: () => void
}) {
  const t = useIntakeText(),
    intl = useIntl(),
    states = getEnrollmentStates(intl)
  const [section, setSection] = useState('data'),
    [preview, setPreview] = useState<string>()
  const [correction, setCorrection] = useState(''),
    [reason, setReason] = useState(''),
    [deadline, setDeadline] = useState(item.campana.correcciones_hasta ?? '')
  const [pinBusy, setPinBusy] = useState(false),
    [pin, setPin] = useState('')
  const [decision, setDecision] = useState(''),
    [group, setGroup] = useState('')
  const base = `/ingreso/solicitudes/${item.url_token}`
  const spanish = intl.locale.startsWith('es')
  const [changingGrade, setChangingGrade] = useState(false)
  const [targetGrade, setTargetGrade] = useState('')
  const changeGradeLabel = spanish ? 'Cambiar grado' : 'Change grade'
  const currentGrade = item.grado_aprobado_token ?? item.grado_token
  const reviewing = ['enviada', 'revision', 'correcciones', 'espera'].includes(item.estado)
  const fields = [
    'primer_nombre',
    'segundo_nombre',
    'primer_apellido',
    'segundo_apellido',
    'nacimiento',
    'tipo_documento',
    'numero_documento',
    'telefono',
    'pais',
    'departamento',
    'municipio',
    'direccion',
    'madre',
    'padre',
    'responsable',
    'parentesco',
    'telefono_responsable',
  ] as const
  const targetLabels = Object.fromEntries([
    ...fields.map((key) => [`datos.${key}`, t(key)]),
    ...item.campana.configuracion.campos.map((field) => [`datos.adicionales.${field.key}`, field.nombre]),
    ...item.campana.configuracion.documentos.map((document) => [`documentos.${document.key}`, document.nombre]),
  ])
  const date = (value: string) =>
    intl.formatDate(value, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: item.campana.zona_horaria,
    })
  const requestCorrection = (target: string) => {
    setCorrection(target)
    setReason('')
  }
  const activatePin = async () => {
    if (busy || pinBusy) return
    setPin('')
    setPinBusy(true)
    try {
      await run(async () => {
        const result = await api.post<{data: Application; pin: string}>(`${base}/pin`, {}, {notifyLocalChange: false})
        await update(result.data)
        setPin(result.pin)
      })
    } finally {
      setPinBusy(false)
    }
  }
  async function saveCorrection() {
    await run(async () => {
      const result = await api.post<{data: Application}>(
        `${base}/correcciones`,
        {campo: correction, motivo: reason, hasta: deadline},
        {notifyLocalChange: false},
      )
      await update(result.data)
      setCorrection('')
    })
  }
  return (
    <div className='intake-stack'>
      <section className='intake-card'>
        <button className='btn btn-sm btn-light mb-5' onClick={back}>
          <IntakeIcon name='arrow-left' />
          {t('backToApplications')}
        </button>
        <div className='intake-heading'>
          <div>
            <h1>{studentName(item)}</h1>
            <p className='intake-muted mb-0'>
              {item.radicado} · {item.campana.nombre}
            </p>
          </div>
          <span className='intake-badge' data-status={item.estado}>
            {states[item.estado]}
          </span>
        </div>
      </section>
      {can('correos.revisar') && <MailReviewPanel path={base + '/revision-correos'} onChange={onMailReview}/>}
      <div className='intake-detail'>
        <section className='intake-card'>
          <nav className='intake-tabs'>
            {['data', 'documents', 'history'].map((tab) => (
              <button key={tab} className={section === tab ? 'active' : ''} onClick={() => setSection(tab)}>
                {t(tab)}
              </button>
            ))}
          </nav>
          {section === 'data' && (
            <>
              <div className='intake-grid'>
                <EnrollmentGradeSummary application={item} />
                {fields.map((key) => (
                  <div key={key}>
                    <div className='intake-muted'>{t(key)}</div>
                    <strong>{item.datos[key] || '—'}</strong>
                    {item.pin_manual &&
                      reviewing &&
                      can('revisar') &&
                      !['tipo_documento', 'numero_documento'].includes(key) && (
                        <button
                          className='btn btn-sm btn-light-warning ms-3'
                          title={t('requestCorrection')}
                          aria-label={`${t('requestCorrection')} ${t(key)}`}
                          onClick={() => requestCorrection(`datos.${key}`)}
                        >
                          <IntakeIcon name='pencil' />
                        </button>
                      )}
                  </div>
                ))}
                <div>
                  <div className='intake-muted'>{t('email')}</div>
                  <strong className='text-break'>{item.email}</strong>
                </div>
                {item.campana.configuracion.campos.map((field) => (
                  <div key={field.key}>
                    <div className='intake-muted'>{field.nombre}</div>
                    <strong>{item.datos.adicionales?.[field.key] || '—'}</strong>
                    {item.pin_manual && reviewing && can('revisar') && (
                      <button
                        className='btn btn-sm btn-light-warning ms-3'
                        onClick={() => requestCorrection(`datos.adicionales.${field.key}`)}
                        aria-label={`${t('requestCorrection')} ${field.nombre}`}
                      >
                        <IntakeIcon name='pencil' />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {section === 'documents' && (
            <>
              {item.documentos.some(doc => doc.anexo_renovacion) && <section className='intake-card'>
                <h3>{spanish ? 'Anexos de renovación' : 'Renewal attachments'}</h3>
                {item.documentos.filter(doc => doc.anexo_renovacion).map(doc =>
                  <a key={doc.url_token} className='d-block text-break' href={`/api${base}/documentos/${doc.url_token}`}>{doc.nombre}</a>)}
              </section>}
              {item.campana.configuracion.documentos
                .filter(
                  (requirement) =>
                    !requirement.grados.length ||
                    requirement.grados.includes(item.grado_aprobado_token ?? item.grado_token ?? ''),
                )
                .map((requirement) => {
                  const versions = item.documentos.filter((document) => document.requisito === requirement.key),
                    latest = versions[0]
                  return (
                    <section className='intake-document' key={requirement.key}>
                      <h3>{requirement.nombre}</h3>
                      <p className='intake-muted'>{requirement.instrucciones}</p>
                      {requirement.vigencia && <p className='intake-muted'>{requirement.vigencia}</p>}
                      {!latest ? (
                        <>
                          <p>{t('awaitingDocument')}</p>
                          {item.pin_manual && reviewing && can('revisar') && <button type='button'
                            className='btn btn-sm btn-light-warning' disabled={busy}
                            onClick={() => requestCorrection(`documentos.${requirement.key}`)}>{t('requestCorrection')}</button>}
                        </>
                      ) : (
                        <>
                          <div className='intake-document-file'>
                            <button className='btn btn-sm btn-light-info' onClick={() => setPreview(latest.url_token)}>
                              <IntakeIcon name='eye' />
                              {latest.nombre}
                            </button>
                            <span className='intake-badge' data-status={latest.estado}>
                              {states[latest.estado]}
                            </span>
                            <small>{t('version', {number: latest.version})}</small>
                          </div>
                          {latest.observacion && <IntakeNotice kind='warning'>{latest.observacion}</IntakeNotice>}
                          {reviewing && can('revisar') && latest.estado !== 'retirado' && (
                            <div className='intake-actions'>
                              <button
                                className='btn btn-sm btn-light-primary'
                                disabled={busy || latest.estado === 'aprobado'}
                                onClick={() =>
                                  void run(async () => {
                                    const result = await api.put<{
                                      data: Application
                                    }>(
                                      `${base}/documentos/${latest.url_token}`,
                                      {
                                        estado: 'aprobado',
                                        observacion: null,
                                      },
                                      {notifyLocalChange: false},
                                    )
                                    await update(result.data)
                                  })
                                }
                              >
                                {t('approveDocument')}
                              </button>
                              <button
                                className='btn btn-sm btn-light-warning'
                                disabled={busy}
                                onClick={() => requestCorrection(`documentos.${requirement.key}`)}
                              >
                                {t('requestCorrection')}
                              </button>
                            </div>
                          )}
                          {versions.length > 1 && (
                            <details className='mt-5'>
                              <summary>{t('previousVersions')}</summary>
                              {versions.slice(1).map((document) => (
                                <p key={document.url_token}>
                                  <button
                                    className='btn btn-sm btn-light'
                                    onClick={() => setPreview(document.url_token)}
                                  >
                                    {document.nombre} · {t('version', {number: document.version})}
                                  </button>
                                </p>
                              ))}
                            </details>
                          )}
                        </>
                      )}
                    </section>
                  )
                })}
              <IntakeNotice>{t('validationHelp')}</IntakeNotice>
              {can('revisar') && (
                <button
                  className='btn btn-primary'
                  disabled={busy || !['enviada', 'revision'].includes(item.estado)}
                  onClick={() =>
                    void run(async () => {
                      const result = await api.post<{data: Application}>(
                        `${base}/validar`,
                        {},
                        {notifyLocalChange: false},
                      )
                      await update(result.data)
                    })
                  }
                >
                  {t('validateDocuments')}
                </button>
              )}
            </>
          )}
          {section === 'history' && (
            <ol className='intake-history'>
              {item.historial.map((event, index) => (
                <li key={index}>
                  <strong>{states[event.evento] ?? intl.formatMessage({id: 'intake.historyUpdate'})}</strong>
                  <small>{date(event.created_at)}</small>
                  {event.observacion}
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside className='intake-stack'>
          <section className='intake-card'>
            <h2>{t('nextStep')}</h2>
            <p className='intake-muted'>{t(`status${item.estado}`)}</p>
            {item.pin_manual && reviewing && can('revisar') && <div className='mb-4'>
              <button type='button' className='btn btn-light-primary w-100' onClick={() => setSection('documents')}>
                {spanish ? 'Revisar documentos' : 'Review documents'}
              </button>
              <p className='intake-muted mt-3 mb-0'>{spanish ? 'Aprueba los documentos y selecciona «Validar documentación» para habilitar la admisión.' : 'Approve the documents and select “Validate documentation” to enable admission.'}</p>
            </div>}
            {can('revisar') || can('configurar')
              ? item.pin_manual &&
                ['pin_pendiente', 'borrador'].includes(item.estado) && !item.enviada_en && (
                  <button className='btn btn-light-info w-100' disabled={busy || pinBusy} onClick={() => void activatePin()}>
                    <IntakeIcon name='ticket-perforated' />
                    {t(item.estado === 'pin_pendiente' ? 'activatePin' : 'reissuePin')}
                  </button>
                )
              : null}
            {can('cambiar_grado') && ['enviada', 'revision', 'correcciones', 'validada', 'espera', 'aprobada'].includes(item.estado) &&
              <button type='button' className='btn btn-light-primary w-100 mt-4' disabled={busy}
                onClick={() => {setTargetGrade(currentGrade ?? ''); setReason(''); setChangingGrade(true)}}>
                <IntakeIcon name='pencil' />{changeGradeLabel}
              </button>}
            {can('decidir') && ['validada', 'espera'].includes(item.estado) && (
              <button
                className='btn btn-primary w-100 mt-4'
                disabled={busy}
                onClick={() => {
                  setReason('')
                  setDecision('aprobada')
                }}
              >
                {t('admitStudent')}
              </button>
            )}
            {can('decidir') && reviewing && (
              <div className='intake-actions mt-4'>
                {['espera', 'rechazada'].map((state) => (
                  <button
                    className='btn btn-sm btn-light-warning'
                    disabled={busy}
                    key={state}
                    onClick={() => {
                      setReason('')
                      setDecision(state)
                    }}
                  >
                    {states[state]}
                  </button>
                ))}
              </div>
            )}
            {can('decidir') && item.pin_manual && !['anulada', 'rechazada', 'matriculada'].includes(item.estado) && (
              <button
                className='btn btn-sm btn-light-danger w-100 mt-4'
                onClick={() => {
                  setReason('')
                  setDecision('anulada')
                }}
                disabled={busy}
              >
                {t('cancelApplication')}
              </button>
            )}
            {can('asignar') && item.estado === 'aprobada' && (
              <div className='mt-5'>
                <label className='form-label' htmlFor='enroll-group'>
                  {t('group')}
                </label>
                <select
                  id='enroll-group'
                  className='form-select'
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  <option value=''>{t('select')}</option>
                  {groups
                    .filter((candidate) => candidate.grado_token === (item.grado_aprobado_token ?? item.grado_token))
                    .map((candidate) => (
                      <option value={candidate.token} key={candidate.token}>
                        {candidate.nombre}
                      </option>
                    ))}
                </select>
                <button
                  className='btn btn-primary w-100 mt-4'
                  disabled={busy || !group}
                  onClick={() => {
                    setReason('')
                    setDecision('matriculada')
                  }}
                >
                  {t('confirmEnrollment')}
                </button>
                <p className='intake-muted mt-4'>{t('credentialsHelp')}</p>
              </div>
            )}
          </section>
          {(pinBusy || pin) && (
            <section className='intake-card' aria-live='polite' aria-busy={pinBusy}>
              <div className='d-flex align-items-center gap-3 mb-4'>
                <span className='intake-avatar'><IntakeIcon name='ticket-perforated' /></span>
                <h3 className='mb-0'>{t(pinBusy ? 'activatingPin' : 'pinReady')}</h3>
              </div>
              {pinBusy ? (
                <div className='placeholder-glow' role='status'>
                  <span className='placeholder col-10 rounded mb-3' style={{height: 36}} />
                  <span className='placeholder col-7 rounded' />
                </div>
              ) : (
                <>
                  <div className='fs-1 fw-bold py-3' style={{letterSpacing: '.12em'}} data-testid='enrollment-pin'>{pin}</div>
                  <p className='intake-muted'>{item.pin_expira_en ? t('pinValidityDate', {date: date(item.pin_expira_en)}) : t('pinNoExpiry')}</p>
                  <button className='btn btn-light-info w-100' onClick={() => void navigator.clipboard.writeText(pin)}>{t('copyPin')}</button>
                  <p className='intake-muted mt-4 mb-0'>{t('pinOnce')}</p>
                </>
              )}
            </section>
          )}
          <section className='intake-card'>
            <h3>{t('corrections')}</h3>
            {item.correcciones?.length ? (
              item.correcciones.map((entry) => (
                <div className='mb-5' key={entry.key}>
                  <strong>{targetLabels[entry.campo] ?? t('data')}</strong>
                  <p>{entry.motivo}</p>
                  <small>
                    {date(entry.hasta)} · {t(entry.resuelta ? 'resolved' : 'pending')}
                  </small>
                </div>
              ))
            ) : (
              <p className='intake-muted'>{t('noCorrections')}</p>
            )}
          </section>
          <section className='intake-card'>
            <IntakePayments />
          </section>
        </aside>
      </div>
      {preview && (
        <IntakeModal title={t('documentPreview')} close={() => setPreview(undefined)} wide>
          <iframe
            title={t('documentPreview')}
            src={`/api${base}/documentos/${preview}?vista=1`}
            style={{border: 0, width: '100%', height: '65vh'}}
          />
          <a className='btn btn-light-info mt-4' href={`/api${base}/documentos/${preview}`}>
            {t('download')}
          </a>
        </IntakeModal>
      )}
      {correction && (
        <IntakeModal
          title={t('requestCorrection')}
          close={() => !busy && setCorrection('')}
          footer={
            <>
              <button className='btn btn-light' disabled={busy} onClick={() => setCorrection('')}>
                {t('cancel')}
              </button>
              <button
                className='btn btn-primary'
                disabled={busy || reason.trim().length < 3 || !deadline}
                onClick={() => void saveCorrection()}
              >
                {busy ? t('processing') : t('sendCorrection')}
              </button>
            </>
          }
        >
          <h3>{targetLabels[correction]}</h3>
          <label htmlFor='correction-reason' className='form-label required'>
            {t('reason')}
          </label>
          <textarea
            id='correction-reason'
            className='form-control mb-5'
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <label htmlFor='correction-deadline' className='form-label required'>
            {t('correctionDeadlineLabel')}
          </label>
          <input
            id='correction-deadline'
            type='datetime-local'
            className='form-control'
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <p className='intake-muted mt-4'>{t('timezone', {timezone: item.campana.zona_horaria ?? ''})}</p>
          <IntakeNotice>{t('correctionOnly')}</IntakeNotice>
        </IntakeModal>
      )}
      {decision && (
        <IntakeModal
          title={t(decision === 'matriculada' ? 'confirmEnrollment' : 'confirmDecision')}
          close={() => !busy && setDecision('')}
          footer={
            <>
              <button className='btn btn-light' disabled={busy} onClick={() => setDecision('')}>
                {t('cancel')}
              </button>
              <button
                className='btn btn-primary'
                disabled={busy || (['rechazada', 'anulada', 'espera'].includes(decision) && reason.trim().length < 3)}
                onClick={() =>
                  void run(async () => {
                    if (decision === 'matriculada') {
                      await api.post(
                        `/ingreso/campanas/${item.campana.url_token}/distribuir`,
                        {
                          confirmar: true,
                          asignaciones: [
                            {
                              solicitud_token: item.url_token,
                              grupo_token: group,
                            },
                          ],
                        },
                        {notifyLocalChange: false},
                      )
                      const result = await api.get<{data: Application}>(base)
                      await update(result.data)
                    } else {
                      const result = await api.post<{data: Application}>(
                        `${base}/decision`,
                        {
                          estado: decision,
                          grado_token: item.grado_aprobado_token ?? item.grado_token,
                          observacion: reason,
                        },
                        {notifyLocalChange: false},
                      )
                      await update(result.data)
                    }
                    setDecision('')
                  })
                }
              >
                {busy ? t('processing') : t('confirm')}
              </button>
            </>
          }
        >
          <IntakeNotice>{t(decision === 'matriculada' ? 'credentialsHelp' : 'decisionHelp')}</IntakeNotice>
          <div className='d-flex flex-wrap gap-6 mb-5'><EnrollmentGradeSummary application={item} /></div>
          <p>
            <strong>{studentName(item)}</strong> · {states[decision]}
          </p>
          <label className='form-label' htmlFor='decision-reason'>
            {t('reason')}
          </label>
          <textarea
            id='decision-reason'
            className='form-control'
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </IntakeModal>
      )}
      {changingGrade && <IntakeModal title={changeGradeLabel} close={() => !busy && setChangingGrade(false)} footer={<>
        <button type='button' className='btn btn-light' disabled={busy} onClick={() => setChangingGrade(false)}>{t('cancel')}</button>
        <button type='button' className='btn btn-primary' disabled={busy || !targetGrade || targetGrade === currentGrade || reason.trim().length < 3}
          onClick={() => void run(async () => {
            const result = await api.put<{data: Application}>(`${base}/grado`, {grado_token: targetGrade, observacion: reason.trim()}, {notifyLocalChange: false})
            await update(result.data)
            setChangingGrade(false)
          })}>{busy ? t('processing') : t('confirm')}</button>
      </>}>
        <div className='d-flex flex-wrap gap-6 mb-5'><EnrollmentGradeSummary application={item} /></div>
        <label htmlFor='school-grade-select' className='form-label required'>{spanish ? 'Grado definido por el colegio' : 'Grade assigned by the school'}</label>
        <select id='school-grade-select' className='form-select mb-5' disabled={busy} value={targetGrade} onChange={event => setTargetGrade(event.target.value)}>
          <option value=''>{t('select')}</option>
          {item.campana.configuracion.grados.map(grade => <option key={grade.token} value={grade.token}>{grade.nombre}</option>)}
        </select>
        <label htmlFor='school-grade-reason' className='form-label required'>{t('reason')}</label>
        <textarea id='school-grade-reason' className='form-control' maxLength={2000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} />
        <p className='intake-muted mt-4 mb-0'>{spanish ? 'El expediente volverá a revisión para validar los requisitos del grado elegido.' : 'The application returns to review so the selected grade requirements can be checked.'}</p>
      </IntakeModal>}
    </div>
  )
}
