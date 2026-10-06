import {useEffect, useRef, useState, type FormEvent} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {useAulaRecurso, useEntregarTarea, useEntregas, useCalificarEntrega, useGuardarPreguntas,
  useIniciarIntento, useIntento, useGuardarRespuestas, useCambiarPaginaIntento, useFinalizarIntento, useReportarIncidente,
  useIntentos, useReactivarIntento, useCalificarIntento, useSubirAdjunto, useMiIntento, aulaAdjuntoUrl, aulaImagenUrl,
  type Attempt, type Question, type AulaScale} from './aula.api'

function GradeField({scale, value, onChange, label}: {scale?: AulaScale; value: string;
  onChange: (value: string) => void; label: string}) {
  return scale?.tipo === 'imagenes' ? <select className='form-select' aria-label={label} value={value}
    onChange={event => onChange(event.target.value)}><option value=''>Selecciona una carita</option>
    {scale.opciones.map(option => <option key={option.url_token} value={option.url_token}>
      {option.emoji ? `${option.emoji} ` : ''}{option.nombre}</option>)}</select>
    : <input type='number' step='0.01' className='form-control' aria-label={label} value={value}
      onChange={event => onChange(event.target.value)} />
}

function Blocks({blocks}: {blocks: {tipo: string; texto?: string; url?: string}[]}) {
  return <div className='aula-blocks'>{blocks.map((block, index) => <div key={index} className={`aula-block aula-block-${block.tipo}`}>
    {block.tipo === 'enlace' && /^https?:\/\//i.test(block.url ?? '')
      ? <a href={block.url} target='_blank' rel='noopener noreferrer'>{block.texto || block.url}</a>
      : block.tipo === 'titulo' ? <h3>{block.texto}</h3> : block.tipo === 'lista'
      ? <ul>{(block.texto ?? '').split('\n').filter(Boolean).map((line, at) => <li key={at}>{line}</li>)}</ul>
      : <p className='mb-0'>{block.texto}</p>}
  </div>)}</div>
}

function TaskPanel({token, canManage, gradeable, existing, scale, reasonRequired, canInteract, isStudent}: {token: string; canManage: boolean; gradeable: boolean;
  scale?: AulaScale; reasonRequired?: boolean;
  canInteract?: boolean; isStudent: boolean;
  existing?: {token: string; texto: string; estado: string; nota: string | null; retroalimentacion: string | null;
    valoracion?: {nombre: string; emoji: string | null} | null; adjuntos: {token: string; nombre: string}[]} | null}) {
  const submit = useEntregarTarea()
  const grades = useCalificarEntrega()
  const upload = useSubirAdjunto()
  const submissions = useEntregas(token, canManage)
  const [text, setText] = useState(existing?.texto ?? '')
  const [message, setMessage] = useState('')
  const [gradeForm, setGradeForm] = useState<Record<string, {nota: string; retroalimentacion: string; motivo?: string}>>({})
  const send = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    try {await submit.mutateAsync({token, texto: text}); setMessage('Entrega guardada.')}
    catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo entregar.')}
  }
  if (canManage) return <section className='mt-8'><h3>Entregas</h3>
    {submissions.isLoading ? <p>Cargando entregas…</p> : submissions.data?.length ? <div className='d-flex flex-column gap-4'>
      {submissions.data.map(item => <article className='border rounded p-4' key={item.token}>
        <div className='fw-semibold'>{item.estudiante} <span className='badge badge-light-info'>{item.estado}</span></div>
        <p className='my-3' style={{whiteSpace: 'pre-wrap'}}>{item.texto}</p>
        {!!item.adjuntos?.length && <p>{item.adjuntos.map(file => <a className='me-3' key={file.token} href={aulaAdjuntoUrl(file.token)}>{file.nombre}</a>)}</p>}
        {gradeable && <div className='d-flex flex-wrap gap-3 align-items-end'><label>Valoración<GradeField scale={scale}
          label={`Valoración de ${item.estudiante}`}
          value={gradeForm[item.token]?.nota ?? (scale?.tipo === 'imagenes' ? item.escala_opcion_token ?? '' : item.nota ?? '')}
          onChange={value => setGradeForm({...gradeForm,
            [item.token]: {...(gradeForm[item.token] ?? {retroalimentacion: item.retroalimentacion ?? ''}), nota: value}})} /></label>
          <label className='flex-grow-1'>Retroalimentación<input className='form-control' value={gradeForm[item.token]?.retroalimentacion ?? item.retroalimentacion ?? ''}
            onChange={event => setGradeForm({...gradeForm, [item.token]: {...(gradeForm[item.token] ?? {nota: item.nota ?? ''}),
              retroalimentacion: event.target.value}})} /></label>
          {reasonRequired && <label>Motivo de la edición<input className='form-control' minLength={8}
            value={gradeForm[item.token]?.motivo ?? ''} onChange={event => setGradeForm({...gradeForm,
              [item.token]: {...(gradeForm[item.token] ?? {nota: '', retroalimentacion: ''}), motivo: event.target.value}})} /></label>}
          <button className='btn btn-success' disabled={grades.isPending || (reasonRequired && (gradeForm[item.token]?.motivo ?? '').trim().length < 8)}
            onClick={() => void grades.mutateAsync({token: item.token, version: item.version,
            ...(scale?.tipo === 'imagenes'
              ? {escala_opcion_token: gradeForm[item.token]?.nota ?? item.escala_opcion_token ?? ''}
              : {nota: gradeForm[item.token]?.nota ?? item.nota ?? ''}),
            retroalimentacion: gradeForm[item.token]?.retroalimentacion ?? item.retroalimentacion ?? '',
            motivo: gradeForm[item.token]?.motivo})
            .then(() => setMessage('Calificación guardada.')).catch(error => setMessage(error instanceof Error ? error.message : 'Error al calificar.'))}>Calificar</button></div>}
      </article>)}</div> : <p className='text-muted'>Todavía no hay entregas.</p>}
    {message && <div className='alert alert-info mt-4'>{message}</div>}</section>
  if (!isStudent) return <div className='alert alert-light mt-7'>Esta tarea está disponible en solo lectura para tu perfil.</div>
  return <section className='mt-8'><h3>Tu entrega</h3>
    {!canInteract && <div className='alert alert-warning'>El plazo de interacción terminó. Tu entrega y su retroalimentación siguen visibles.</div>}
    {existing && <p className='text-muted'>Estado: {existing.estado}
      {existing.valoracion ? ` · ${existing.valoracion.emoji ?? ''} ${existing.valoracion.nombre}` : existing.nota ? ` · Nota: ${existing.nota}` : ''}
      {existing.retroalimentacion ? ` · ${existing.retroalimentacion}` : ''}</p>}
    {canInteract && <form onSubmit={event => void send(event)}><textarea className='form-control mb-3' rows={7} maxLength={20000}
      placeholder='Escribe tu respuesta…' value={text} onChange={event => setText(event.target.value)} />
      <button className='btn btn-success' disabled={submit.isPending}>Guardar entrega</button>
      <span className='text-muted ms-3'>El texto es opcional; después puedes adjuntar un archivo.</span></form>}
    {existing && <div className='mt-4'><label className='form-label'>Adjuntar archivo a tu entrega<input className='form-control' type='file'
      disabled={upload.isPending || !canInteract} onChange={event => {const file = event.target.files?.[0]; if (file) void upload.mutateAsync({token: existing.token,
        archivo: file, destino: 'entregas'}).then(() => setMessage('Archivo adjuntado.')).catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo adjuntar.'))}} /></label>
      {!!existing.adjuntos?.length && <p className='mt-2'>{existing.adjuntos.map(file => <a className='me-3' key={file.token}
        href={aulaAdjuntoUrl(file.token)}>{file.nombre}</a>)}</p>}</div>}
    {message && <div className='alert alert-info mt-4'>{message}</div>}</section>
}

function QuestionBuilder({token, current}: {token: string; current: Question[]}) {
  const save = useGuardarPreguntas()
  const [questions, setQuestions] = useState(() => current.map(item => ({tipo: item.tipo, enunciado: item.enunciado,
    opciones: (item.opciones ?? []).join('\n'), respuesta: Array.isArray(item.respuesta_correcta?.valor)
      ? item.respuesta_correcta.valor.join('\n') : String(item.respuesta_correcta?.valor ?? ''), puntos: item.puntos})))
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    try {await save.mutateAsync({token, preguntas: questions.map(item => ({tipo: item.tipo, enunciado: item.enunciado,
      opciones: item.opciones.split('\n').map(line => line.trim()).filter(Boolean),
      respuesta_correcta: item.tipo === 'abierta' ? null : {valor: ['multiple', 'correspondencia', 'orden'].includes(item.tipo)
        ? item.respuesta.split('\n').map(line => line.trim()).filter(Boolean) : item.respuesta.trim()}, puntos: item.puntos}))})
      setMessage('Preguntas guardadas.')
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudieron guardar las preguntas.')}
  }
  return <section className='mt-8'><div className='d-flex justify-content-between align-items-center'><h3>Preguntas del cuestionario</h3>
    <button className='btn btn-light-success' onClick={() => setQuestions([...questions, {tipo: 'unica', enunciado: '', opciones: '', respuesta: '', puntos: '1'}])}>+ Pregunta</button></div>
    <p className='text-muted'>La clave correcta solo se muestra al personal autorizado. Tras el primer intento no se pueden cambiar las preguntas.</p>
    <form onSubmit={event => void submit(event)}>{questions.map((item, index) => <div className='border rounded p-4 mb-4' key={index}>
      <div className='d-flex gap-3 mb-3'><strong>Pregunta {index + 1}</strong><select className='form-select form-select-sm w-auto' value={item.tipo}
        onChange={event => setQuestions(questions.map((q, at) => at === index ? {...q, tipo: event.target.value} : q))}>
        <option value='unica'>Selección única</option><option value='multiple'>Selección múltiple</option><option value='booleano'>Verdadero/falso</option>
        <option value='correspondencia'>Correspondencia</option><option value='orden'>Ordenamiento</option><option value='abierta'>Respuesta abierta</option></select>
        <button type='button' className='btn btn-sm btn-light-danger ms-auto' onClick={() => setQuestions(questions.filter((_, at) => at !== index))}>Quitar</button></div>
      <label className='form-label w-100'>Enunciado<textarea className='form-control' required value={item.enunciado}
        onChange={event => setQuestions(questions.map((q, at) => at === index ? {...q, enunciado: event.target.value} : q))} /></label>
      {item.tipo !== 'abierta' && <div className='row g-3'><div className='col-md-6'><label className='form-label'>Opciones, una por línea<textarea className='form-control' rows={3}
        value={item.opciones} onChange={event => setQuestions(questions.map((q, at) => at === index ? {...q, opciones: event.target.value} : q))} /></label></div>
        <div className='col-md-6'><label className='form-label'>Respuesta correcta{['multiple', 'correspondencia', 'orden'].includes(item.tipo) ? ', una por línea' : ''}
          <textarea className='form-control' rows={3} required value={item.respuesta}
            onChange={event => setQuestions(questions.map((q, at) => at === index ? {...q, respuesta: event.target.value} : q))} /></label></div></div>}
      <label className='form-label mt-3'>Puntos<input type='number' step='0.001' min='0.001' max='100' className='form-control' style={{width: 130}} value={item.puntos}
        onChange={event => setQuestions(questions.map((q, at) => at === index ? {...q, puntos: event.target.value} : q))} /></label>
    </div>)}
      {!!questions.length && <button className='btn btn-success' disabled={save.isPending}>Guardar preguntas</button>}
    </form>{message && <div className='alert alert-info mt-4'>{message}</div>}</section>
}

function AttemptSession({attempt}: {attempt: Attempt}) {
  const save = useGuardarRespuestas()
  const saveAnswers = save.mutateAsync
  const changePage = useCambiarPaginaIntento()
  const finish = useFinalizarIntento()
  const incident = useReportarIncidente()
  const reportIncident = incident.mutateAsync
  const [answers, setAnswers] = useState<Attempt['respuestas']>(attempt.respuestas)
  const [page, setPage] = useState(attempt.pagina_actual)
  const [questions, setQuestions] = useState(attempt.preguntas)
  const [lockedAnswers, setLockedAnswers] = useState(() => new Set(Object.keys(attempt.respuestas)))
  const [status, setStatus] = useState(attempt.estado)
  const [message, setMessage] = useState('')
  const examRef = useRef<HTMLElement>(null)
  const [focused, setFocused] = useState(false)
  const active = useRef(status === 'en_curso')
  useEffect(() => setStatus(attempt.estado), [attempt.estado])
  useEffect(() => {active.current = status === 'en_curso'}, [status])
  useEffect(() => {
    const syncFocus = () => setFocused(document.fullscreenElement === examRef.current)
    document.addEventListener('fullscreenchange', syncFocus)
    return () => document.removeEventListener('fullscreenchange', syncFocus)
  }, [])
  const persist = async () => {
    await save.mutateAsync({token: attempt.token, respuestas: answers})
    if (!attempt.permitir_editar_respuestas) setLockedAnswers(new Set(Object.keys(answers)))
  }
  useEffect(() => {
    if (!active.current) return
    const timer = window.setInterval(() => {if (active.current) void saveAnswers({token: attempt.token, respuestas: answers})
      .then(() => {if (!attempt.permitir_editar_respuestas) setLockedAnswers(new Set(Object.keys(answers)))})
      .catch(() => setMessage('No se pudieron guardar las respuestas.'))}, 10000)
    return () => window.clearInterval(timer)
  }, [answers, attempt.token, attempt.permitir_editar_respuestas, saveAnswers])
  useEffect(() => {
    if (!attempt.vigilado || status !== 'en_curso') return
    const report = (tipo: 'visibilidad' | 'pantalla_completa') => {
      if (!active.current) return
      void reportIncident({token: attempt.token, tipo}).then(data => {
        setStatus(data.estado)
        if (data.estado === 'bloqueado') setMessage('El intento quedó bloqueado. Solicita revisión al docente.')
      }).catch(() => setMessage('No se pudo verificar el incidente con el servidor.'))
    }
    const visibility = () => {if (document.hidden) report('visibilidad')}
    const fullscreen = () => {if (!document.fullscreenElement) report('pantalla_completa')}
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('fullscreenchange', fullscreen)
    return () => {document.removeEventListener('visibilitychange', visibility); document.removeEventListener('fullscreenchange', fullscreen)}
  }, [attempt.token, attempt.vigilado, status, reportIncident])
  const complete = async () => {
    setMessage('')
    try {await persist(); const result = await finish.mutateAsync(attempt.token)
      active.current = false; setStatus(result.estado); setMessage(result.valoracion
        ? `Intento enviado. Valoración: ${result.valoracion.emoji ?? ''} ${result.valoracion.nombre}`
        : result.nota ? `Intento enviado. Nota: ${result.nota}` : 'Intento enviado. Pendiente de revisión docente.')
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo finalizar.')}
  }
  const goPage = async (target: number) => {
    setMessage('')
    try {await persist(); const result = await changePage.mutateAsync({token: attempt.token, pagina: target})
      setPage(result.pagina_actual); setQuestions(result.preguntas)
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo cambiar de página.')}
  }
  const pageCount = Math.max(1, Math.ceil(attempt.preguntas_total / attempt.preguntas_por_pagina))
  const visibleQuestions = questions
  return <section ref={examRef} className='aula-exam-session mt-8'><h3>Cuestionario · intento {attempt.numero}</h3>
    {status !== 'en_curso' && <div className='alert alert-secondary'>Estado: {status}.
      {attempt.valoracion ? ` Resultado: ${attempt.valoracion.emoji ?? ''} ${attempt.valoracion.nombre}.`
        : attempt.nota ? ` Resultado: ${attempt.nota}.` : ' El docente revisará el resultado.'}</div>}
    <div className='alert alert-info'>Tiempo hasta: {new Date(attempt.vence_at).toLocaleString()} · Estado: {status}.
      {attempt.vigilado && <> Modo vigilado: {attempt.incidentes_permitidos} incidentes permitidos. Al siguiente se bloquea el intento.
        Los eventos del navegador no son prueba de fraude; las capturas de pantalla no pueden impedirse por completo.</>}</div>
    {status === 'en_curso' && !focused && <button className='btn btn-light-primary mb-5'
      onClick={() => void examRef.current?.requestFullscreen().catch(() => setMessage('No se pudo activar la pantalla completa.'))}>
      {attempt.vigilado ? 'Entrar al modo vigilado' : 'Presentar en pantalla completa'}</button>}
    {focused && !attempt.vigilado && <button className='btn btn-light mb-5' onClick={() => void document.exitFullscreen()}>
      Salir de pantalla completa</button>}
    {status === 'en_curso' && <p className='text-muted'>Página {page} de {pageCount}.
      {!attempt.permitir_regresar && ' Al avanzar no podrás regresar.'}
      {!attempt.permitir_editar_respuestas && ' Las respuestas guardadas no se pueden cambiar.'}</p>}
    {status === 'en_curso' && visibleQuestions.map((q, index) => <div className='border rounded p-4 mb-4' key={q.token}><h4>{(page - 1) * attempt.preguntas_por_pagina + index + 1}. {q.enunciado}</h4>
      {q.tipo === 'abierta' ? <textarea className='form-control' rows={5} value={String(answers[q.token] ?? '')}
        disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
        onChange={event => setAnswers({...answers, [q.token]: event.target.value})} />
      : q.tipo === 'multiple' ? (q.opciones ?? []).map(option => <label className='form-check mb-2' key={option}>
        <input className='form-check-input' type='checkbox' checked={Array.isArray(answers[q.token]) && answers[q.token].includes(option)}
          disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
          onChange={event => setAnswers({...answers, [q.token]: event.target.checked
            ? [...(Array.isArray(answers[q.token]) ? answers[q.token] as string[] : []), option]
            : (Array.isArray(answers[q.token]) ? answers[q.token] as string[] : []).filter(value => value !== option)})} />{option}</label>)
      : q.tipo === 'unica' || q.tipo === 'booleano' ? (q.opciones?.length ? q.opciones : ['Verdadero', 'Falso']).map(option =>
        <label className='form-check mb-2' key={option}><input className='form-check-input' type='radio' name={q.token}
          disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
          checked={answers[q.token] === option} onChange={() => setAnswers({...answers, [q.token]: option})} />{option}</label>)
      : <textarea className='form-control' rows={4} placeholder='Una respuesta por línea, en el orden correspondiente'
        disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
        value={Array.isArray(answers[q.token]) ? (answers[q.token] as string[]).join('\n') : ''}
        onChange={event => setAnswers({...answers, [q.token]: event.target.value.split('\n').filter(Boolean)})} />}
    </div>)}
    {status === 'en_curso' && <div className='d-flex flex-wrap gap-3'>
      {page > 1 && attempt.permitir_regresar && <button className='btn btn-light' disabled={changePage.isPending || save.isPending}
        onClick={() => void goPage(page - 1)}>← Página anterior</button>}
      {page < pageCount && <button className='btn btn-light-primary' disabled={changePage.isPending || save.isPending}
        onClick={() => void goPage(page + 1)}>Guardar y avanzar →</button>}
      <button className='btn btn-light-success' disabled={save.isPending}
        onClick={() => void persist().then(() => setMessage('Respuestas guardadas.'))
          .catch(error => setMessage(error instanceof Error ? error.message : 'No se pudieron guardar.'))}>Guardar respuestas</button>
      <button className='btn btn-success' disabled={finish.isPending || save.isPending} onClick={() => void complete()}>Finalizar intento</button></div>}
    {message && <div className='alert alert-info mt-4'>{message}</div>}
  </section>
}

function QuizPanel({token, canManage, current, scale, canInteract, isStudent}: {token: string; canManage: boolean; current: Question[];
  scale?: AulaScale; canInteract?: boolean; isStudent: boolean}) {
  const start = useIniciarIntento()
  const [attemptToken, setAttemptToken] = useState('')
  const own = useMiIntento(token, !canManage)
  const attempt = useIntento(attemptToken)
  useEffect(() => {if (own.data?.token && !attemptToken) setAttemptToken(own.data.token)}, [own.data?.token, attemptToken])
  const attempts = useIntentos(token, canManage)
  const reactivate = useReactivarIntento()
  const grade = useCalificarIntento()
  const [grades, setGrades] = useState<Record<string, string>>({})
  const [reviewToken, setReviewToken] = useState('')
  const review = useIntento(reviewToken)
  const [message, setMessage] = useState('')
  return <>
    {canManage ? <><QuestionBuilder token={token} current={current} />
      <section className='mt-8'><h3>Intentos</h3>{attempts.data?.length ? attempts.data.map(item => <div className='aula-resource-item' key={item.token}>
        <strong className='flex-grow-1'>{item.estudiante} · intento {item.numero}</strong><span>{item.estado} · Incidentes: {item.incidentes} · Nota: {item.nota ?? 'Pendiente'}</span>
        <button type='button' className='btn btn-sm btn-light-primary' onClick={() => setReviewToken(item.token)}>Revisar respuestas</button>
        {['finalizado', 'pendiente_revision', 'tiempo_agotado'].includes(item.estado) && <div className='d-flex gap-2 align-items-center'>
          <GradeField scale={scale} label={`Valoración de ${item.estudiante}`}
            value={grades[item.token] ?? (scale?.tipo === 'imagenes' ? item.escala_opcion_token ?? '' : item.nota ?? '')}
            onChange={value => setGrades({...grades, [item.token]: value})} />
          <button className='btn btn-sm btn-light-success' disabled={grade.isPending} onClick={() => {
            const motivo = window.prompt('Motivo de la revisión o confirmación (mínimo 8 caracteres):')
            if (motivo) void grade.mutateAsync({token: item.token, version: item.version, motivo,
              ...(scale?.tipo === 'imagenes'
                ? {escala_opcion_token: grades[item.token] ?? item.escala_opcion_token ?? ''}
                : {nota: grades[item.token] ?? item.nota ?? ''})})
              .then(() => setMessage('Nota confirmada en el Aula y, si se vinculó, en la planilla.'))
              .catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo calificar.'))
          }}>Confirmar nota</button></div>}
        {item.estado === 'bloqueado' && <button className='btn btn-sm btn-light-success' disabled={reactivate.isPending} onClick={() => {
          const motivo = window.prompt('Motivo de reactivación (mínimo 8 caracteres):')
          if (motivo) void reactivate.mutateAsync({token: item.token, motivo}).then(() => setMessage('Intento reactivado.'))
            .catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo reactivar.'))
        }}>Reactivar</button>}</div>) : <p className='text-muted'>No hay intentos todavía.</p>}
        {reviewToken && <div className='border rounded p-5 mt-5'><div className='d-flex justify-content-between align-items-center gap-3'>
          <h4 className='mb-0'>Respuestas del intento</h4><button className='btn btn-sm btn-light' onClick={() => setReviewToken('')}>Cerrar</button></div>
          {review.isLoading ? <p className='mt-4'>Cargando respuestas…</p> : review.data ? <>
            <p className='text-muted mt-3'>Revisa especialmente las preguntas abiertas antes de confirmar la nota. La calificación general se registra en la fila del intento.</p>
            {review.data.preguntas.map((question, index) => <div className='border-top py-4' key={question.token}>
              <strong>{index + 1}. {question.enunciado}</strong><span className='badge badge-light ms-2'>{question.tipo}</span>
              <p className='mb-0 mt-2'>{Array.isArray(review.data?.respuestas[question.token])
                ? (review.data.respuestas[question.token] as string[]).join(' · ')
                : String(review.data?.respuestas[question.token] ?? 'Sin respuesta')}</p></div>)}</>
            : <p className='text-danger mt-4'>No se pudieron cargar las respuestas.</p>}</div>}</section></>
      : !isStudent ? <div className='alert alert-light mt-7'>Este cuestionario está disponible en solo lectura para tu perfil.</div>
      : !attemptToken ? <button className='btn btn-success mt-8' disabled={start.isPending || !canInteract} onClick={() => void start.mutateAsync(token)
        .then(data => setAttemptToken(data.token)).catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo iniciar.'))}>Iniciar o continuar cuestionario</button>
        : attempt.data ? <><AttemptSession key={attempt.data.token} attempt={attempt.data} />
          {canInteract && ['finalizado', 'tiempo_agotado'].includes(attempt.data.estado) &&
            <button className='btn btn-light-success mt-4' disabled={start.isPending} onClick={() => void start.mutateAsync(token)
              .then(data => setAttemptToken(data.token))
              .catch(error => setMessage(error instanceof Error ? error.message : 'No hay otro intento disponible.'))}>
              Iniciar otro intento si está permitido</button>}</> : <p className='mt-7'>Cargando intento…</p>}
    {message && <div className='alert alert-info mt-4'>{message}</div>}
  </>
}

export function AulaRecursoView() {
  const {recursoToken = ''} = useParams()
  const navigate = useNavigate()
  const {data, isLoading, error} = useAulaRecurso(recursoToken)
  const upload = useSubirAdjunto()
  const [uploadMessage, setUploadMessage] = useState('')
  if (isLoading) return <div className='card card-body'>Cargando recurso…</div>
  if (error || !data) return <div className='alert alert-danger'>No se pudo abrir este recurso. {error?.message}</div>
  const canManage = data.puede_gestionar === true
  return <div className='card'><div className='card-body'>
    <button className='btn btn-link p-0 mb-4' onClick={() => navigate(-1)}>← Volver al aula</button>
    <div className='d-flex flex-wrap align-items-center gap-3'><span className={`aula-resource-kind aula-resource-kind-${data.tipo}`}>{data.tipo}</span>
      <h2 className='mb-0'>{data.titulo}</h2></div>
    <div className='text-muted my-4'>{data.calificable ? 'Calificable' : 'No calificable'}
      {data.fecha_limite ? ` · Hasta ${new Date(data.fecha_limite).toLocaleString()}` : ' · Sin fecha límite'}
      {data.actividad_token ? ' · Vinculado a la planilla' : ''}</div>
    <Blocks blocks={data.contenido?.bloques ?? []} />
    {!!data.adjuntos?.length && <div className='mt-6'><h3>Archivos de apoyo</h3>{data.adjuntos.map(file =>
      <div key={file.token} className='d-inline-block align-top me-3 mb-3'>
        {file.es_imagen && <img className='aula-inline-image d-block rounded mb-2' loading='lazy'
          src={aulaImagenUrl(file.token)} alt={file.nombre} />}
        <a className='d-inline-block border rounded p-3' href={aulaAdjuntoUrl(file.token)}>{file.nombre}</a>
      </div>)}</div>}
    {canManage && <div className='mt-5'><label className='form-label'>Subir archivo de apoyo<input className='form-control' type='file'
      disabled={upload.isPending} onChange={event => {const file = event.target.files?.[0]; if (file) void upload.mutateAsync({token: recursoToken,
        archivo: file, destino: 'recursos'}).then(() => setUploadMessage('Archivo agregado.')).catch(error => setUploadMessage(error instanceof Error ? error.message : 'No se pudo agregar.'))}} /></label>
      {uploadMessage && <div className='alert alert-info mt-2'>{uploadMessage}</div>}</div>}
    {data.tipo === 'tarea' && <TaskPanel key={data.entrega?.token ?? 'new'} token={recursoToken}
      canManage={data.puede_calificar === true} isStudent={data.estudiante === true}
      gradeable={data.calificable} existing={data.entrega} scale={data.escala}
      reasonRequired={data.requiere_motivo} canInteract={data.puede_interactuar} />}
    {data.tipo === 'cuestionario' && <QuizPanel token={recursoToken} canManage={data.puede_evaluar === true}
      isStudent={data.estudiante === true} current={data.preguntas ?? []} scale={data.escala}
      canInteract={data.puede_interactuar} />}
  </div></div>
}
