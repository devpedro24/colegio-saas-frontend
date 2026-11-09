import {useState} from 'react'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import type {Application, ApplicationsPage} from './ingreso.types'
import {getEnrollmentStates} from './ingreso.types'
import {IntakeIcon, IntakeModal, IntakeNotice, IntakePayments} from './IntakeUI'
import {studentName, useIntakeText} from './intakeWorkflow'

export function EnrollmentApplication({
  application: item,
  groups,
  can,
  busy,
  run,
  update,
  back,
}: {
  application: Application
  groups: ApplicationsPage['grupos']
  can: (action: string) => boolean
  busy: boolean
  run: (action: () => Promise<void>) => Promise<void>
  update: (next: Application) => Promise<void>
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
  const [pinDialog, setPinDialog] = useState(false),
    [expires, setExpires] = useState(item.campana.configuracion.pin_expira_en ?? ''),
    [pin, setPin] = useState('')
  const [decision, setDecision] = useState(''),
    [group, setGroup] = useState('')
  const base = `/ingreso/solicitudes/${item.url_token}`
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
  const closePin = () => {
    if (!busy) {
      setPinDialog(false)
      setPin('')
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
              {item.campana.configuracion.documentos
                .filter(
                  (requirement) =>
                    !requirement.grados.length ||
                    requirement.grados.includes(item.grado_aprobado_token ?? item.grado_token),
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
                        <p>{t('awaitingDocument')}</p>
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
            {can('revisar') || can('configurar')
              ? item.pin_manual &&
                !['anulada', 'rechazada', 'matriculada'].includes(item.estado) && (
                  <button className='btn btn-light-info w-100' disabled={busy} onClick={() => setPinDialog(true)}>
                    <IntakeIcon name='ticket-perforated' />
                    {t(item.estado === 'pin_pendiente' ? 'activatePin' : 'reissuePin')}
                  </button>
                )
              : null}
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
      {pinDialog && (
        <IntakeModal
          title={t('activatePin')}
          close={closePin}
          footer={
            <button className='btn btn-light' disabled={busy} onClick={closePin}>
              {t('close')}
            </button>
          }
        >
          <IntakeNotice>{t('manualDelivery')}</IntakeNotice>
          {pin ? (
            <>
              <div className='display-5 fw-bold text-center py-6' aria-live='polite'>
                {pin}
              </div>
              <button className='btn btn-light-info w-100' onClick={() => void navigator.clipboard.writeText(pin)}>
                {t('copyPin')}
              </button>
              <p className='intake-muted mt-4'>{t('pinOnce')}</p>
            </>
          ) : (
            <>
              <label className='form-label' htmlFor='pin-expiry'>
                {t('pinExpiry')}
              </label>
              <input
                id='pin-expiry'
                type='datetime-local'
                className='form-control'
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
              <p className='intake-muted mt-4'>{t('timezone', {timezone: item.campana.zona_horaria ?? ''})}</p>
              <button
                className='btn btn-primary w-100'
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await api.post<{
                      data: Application
                      pin: string
                    }>(`${base}/pin`, {expira_en: expires || null}, {notifyLocalChange: false})
                    setPin(result.pin)
                    await update(result.data)
                  })
                }
              >
                {busy ? t('processing') : t('activatePin')}
              </button>
            </>
          )}
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
    </div>
  )
}
