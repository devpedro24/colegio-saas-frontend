import {useEffect, useRef, useState, type FormEvent} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import {AulaWorkspace} from './AulaWorkspace'
import {AulaQuestionBuilder} from './AulaQuestionBuilder'
import {AulaAttachmentGallery} from './AulaAttachmentGallery'
import {useAulaRecurso, useAbrirRecurso, useEntregarTarea, useBorradorEntrega, useEntregas, useCalificarEntrega, useRevisarEntrega,
  useIniciarIntento, useIntento, useGuardarRespuestas, useCambiarPaginaIntento, useFinalizarIntento, useReportarIncidente,
  useIntentos, useReactivarIntento, useReintentarPlanilla, useVincularPlanilla, useCalificarIntento, useSubirAdjunto, useQuitarAdjunto, useMiIntento, useAula,
  useSubirRespuestaMedio, useRevisarPreguntas, aulaPreguntaMedioUrl, aulaRespuestaMedioUrl,
  aulaAdjuntoUrl, type Attempt, type Question, type QuestionMedia, type AulaScale} from './aula.api'

const schoolDate = (value: string, zone: string | null) => new Intl.DateTimeFormat('es-CO', {
  timeZone: zone || 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value))

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

function QuestionMediaPreview({media}: {media: QuestionMedia[]}) {
  if (!media.length) return null
  return <div className='aula-question-preview-list'>{media.map(file => <figure key={file.token} className='aula-question-preview-item'>
    {file.mime.startsWith('image/') ? <img src={aulaPreguntaMedioUrl(file.token)} alt={file.nombre} />
      : file.mime.startsWith('audio/') ? <audio controls preload='none' src={aulaPreguntaMedioUrl(file.token)} />
      : <video controls preload='metadata' src={aulaPreguntaMedioUrl(file.token)} />}
    <figcaption>{file.nombre}</figcaption>
  </figure>)}</div>
}

function TaskPanel({token, canManage, gradeable, existing, scale, reasonRequired, canInteract, isStudent, reenvios}: {token: string; canManage: boolean; gradeable: boolean;
  scale?: AulaScale; reasonRequired?: boolean;
  canInteract?: boolean; isStudent: boolean; reenvios?: boolean;
  existing?: {token: string; texto: string | null; estado: string; nota: string | null; retroalimentacion: string | null;
    valoracion?: {nombre: string; emoji: string | null} | null; adjuntos: {token: string; nombre: string}[]} | null}) {
  const submit = useEntregarTarea()
  const draft = useBorradorEntrega()
  const grades = useCalificarEntrega()
  const review = useRevisarEntrega()
  const upload = useSubirAdjunto()
  const remove = useQuitarAdjunto()
  const submissions = useEntregas(token, canManage)
  const [text, setText] = useState(existing?.texto ?? '')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [draftToken, setDraftToken] = useState(existing?.estado === 'borrador' ? existing.token : '')
  const [message, setMessage] = useState('')
  const canEditEvidence = canInteract && existing?.nota === null
    && (existing?.estado === 'borrador' || (reenvios && existing?.estado === 'entregada'))
  const [gradeForm, setGradeForm] = useState<Record<string, {nota: string; retroalimentacion: string; motivo?: string}>>({})
  const send = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    if (!text.trim() && !selectedFiles.length && !existing?.adjuntos.length) {
      setMessage('Escribe una respuesta o selecciona al menos un archivo.'); return
    }
    try {
      let attachmentTarget = draftToken || existing?.token || ''
      if (selectedFiles.length && !attachmentTarget && !existing) {
        const reserved = await draft.mutateAsync(token)
        attachmentTarget = reserved.token; setDraftToken(attachmentTarget)
      }
      for (const file of selectedFiles) {
        if (!attachmentTarget) throw new Error('No se pudo preparar la entrega para adjuntar archivos.')
        await upload.mutateAsync({token: attachmentTarget, archivo: file, destino: 'entregas'})
        setSelectedFiles(current => current.filter(item => item !== file))
      }
      await submit.mutateAsync({token, texto: text})
      setDraftToken(''); setMessage('Entrega enviada.')
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : 'No se pudo entregar.'} Revisa los archivos ya adjuntados antes de reintentar para no subirlos dos veces.`)
    }
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
        {!gradeable && <div className='d-flex flex-wrap gap-3 align-items-end'><label className='flex-grow-1'>Retroalimentación
          <input className='form-control' value={gradeForm[item.token]?.retroalimentacion ?? item.retroalimentacion ?? ''}
            onChange={event => setGradeForm({...gradeForm, [item.token]: {...(gradeForm[item.token] ?? {nota: ''}),
              retroalimentacion: event.target.value}})} /></label>
          <button className='btn btn-success' disabled={review.isPending || item.estado === 'revisada'}
            onClick={() => void review.mutateAsync({token: item.token, version: item.version,
              retroalimentacion: gradeForm[item.token]?.retroalimentacion ?? item.retroalimentacion ?? ''})
              .then(() => setMessage('Entrega revisada.')).catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo revisar.'))}>
            {item.estado === 'revisada' ? 'Revisada' : 'Marcar como revisada'}</button></div>}
      </article>)}</div> : <p className='text-muted'>Todavía no hay entregas.</p>}
    {message && <div className='alert alert-info mt-4'>{message}</div>}</section>
  if (!isStudent) return <div className='alert alert-light mt-7'>Esta tarea está disponible en solo lectura para tu perfil.</div>
  return <section className='mt-8'><h3>Tu entrega</h3>
    {!canInteract && <div className='alert alert-warning'>El plazo de interacción terminó. Tu entrega y su retroalimentación siguen visibles.</div>}
    {existing && <p className='text-muted'>Estado: {existing.estado}
      {existing.valoracion ? ` · ${existing.valoracion.emoji ?? ''} ${existing.valoracion.nombre}` : existing.nota ? ` · Nota: ${existing.nota}` : ''}
      {existing.retroalimentacion ? ` · ${existing.retroalimentacion}` : ''}</p>}
    {canInteract && (!existing || existing.estado === 'borrador' || (reenvios && existing.estado === 'entregada'))
      && <form onSubmit={event => void send(event)}><textarea className='form-control mb-3' rows={7} maxLength={20000}
      placeholder='Escribe tu respuesta…' value={text} onChange={event => setText(event.target.value)} />
      <label className='form-label d-block'>Archivos de la entrega<input className='form-control mt-2' type='file' multiple
        onChange={event => {setSelectedFiles(current => [...current, ...Array.from(event.target.files ?? [])]); event.target.value = ''}} /></label>
      {!!selectedFiles.length && <div className='mb-3'>{selectedFiles.map((file, index) => <span className='aula-selected-file me-2' key={`${file.name}-${index}`}>
        {file.name} <button type='button' className='btn btn-sm btn-light-danger' onClick={() =>
          setSelectedFiles(current => current.filter((_, position) => position !== index))}>Quitar</button></span>)}</div>}
      <button className='btn btn-success' disabled={submit.isPending || draft.isPending || upload.isPending}>Enviar entrega</button>
      <span className='text-muted ms-3'>Puedes enviar texto, archivos o ambos.</span></form>}
    {existing && <div className='mt-4'>
      {!!existing.adjuntos?.length && <div className='aula-submission-files mt-2'>{existing.adjuntos.map(file =>
        <span className='aula-selected-file' key={file.token}><a href={aulaAdjuntoUrl(file.token)}>{file.nombre}</a>
          {canEditEvidence && <button className='btn btn-sm btn-light-danger' type='button'
            disabled={remove.isPending} onClick={() => {
              if (!window.confirm(`¿Quitar «${file.nombre}» de tu entrega?`)) return
              void remove.mutateAsync(file.token).then(() => setMessage('Archivo quitado.'))
                .catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo quitar.'))
            }}>Quitar</button>}</span>)}</div>}</div>}
    {message && <div className='alert alert-info mt-4'>{message}</div>}</section>
}

function AttemptSession({attempt}: {attempt: Attempt}) {
  const save = useGuardarRespuestas()
  const uploadResponse = useSubirRespuestaMedio()
  const saveAnswers = save.mutateAsync
  const changePage = useCambiarPaginaIntento()
  const finish = useFinalizarIntento()
  const incident = useReportarIncidente()
  const reportIncident = incident.mutateAsync
  const [answers, setAnswers] = useState<Attempt['respuestas']>(attempt.respuestas)
  const answersRef = useRef<Attempt['respuestas']>(attempt.respuestas)
  const uploadingRef = useRef(false)
  const [page, setPage] = useState(attempt.pagina_actual)
  const [questions, setQuestions] = useState(attempt.preguntas)
  const [lockedAnswers, setLockedAnswers] = useState(() => new Set(Object.keys(attempt.respuestas)))
  const [status, setStatus] = useState(attempt.estado)
  const setQuestionAnswer = (token: string, value: string | string[]) => {
    const next = {...answersRef.current, [token]: value}
    answersRef.current = next; setAnswers(next)
  }
  const [message, setMessage] = useState('')
  const examRef = useRef<HTMLElement>(null)
  const [focused, setFocused] = useState(false)
  const active = useRef(status === 'en_curso')
  useEffect(() => setStatus(attempt.estado), [attempt.estado])
  useEffect(() => {answersRef.current = answers}, [answers])
  useEffect(() => {active.current = status === 'en_curso'}, [status])
  useEffect(() => {
    const syncFocus = () => setFocused(document.fullscreenElement === examRef.current)
    document.addEventListener('fullscreenchange', syncFocus)
    return () => document.removeEventListener('fullscreenchange', syncFocus)
  }, [])
  const persist = async () => {
    if (uploadingRef.current) throw new Error('Espera a que termine de subir la respuesta multimedia.')
    await save.mutateAsync({token: attempt.token, respuestas: answersRef.current})
    if (!attempt.permitir_editar_respuestas) setLockedAnswers(new Set(Object.keys(answersRef.current)))
  }
  useEffect(() => {
    if (!active.current) return
    const timer = window.setInterval(() => {if (active.current && !uploadingRef.current) void saveAnswers({token: attempt.token, respuestas: answersRef.current})
      .then(() => {if (!attempt.permitir_editar_respuestas) setLockedAnswers(new Set(Object.keys(answersRef.current)))})
      .catch(() => setMessage('No se pudieron guardar las respuestas.'))}, 10000)
    return () => window.clearInterval(timer)
  }, [attempt.token, attempt.permitir_editar_respuestas, saveAnswers])
  const uploadAnswer = async (question: Question, file: File) => {
    setMessage(''); uploadingRef.current = true
    try {
      const result = await uploadResponse.mutateAsync({intento: attempt.token, pregunta: question.token, archivo: file})
      const updated = {...answersRef.current, [question.token]: result.token}
      answersRef.current = updated; setAnswers(updated)
      if (!attempt.permitir_editar_respuestas) setLockedAnswers(current => new Set([...current, question.token]))
      setMessage('Respuesta multimedia subida y guardada.')
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo subir la respuesta.')}
    finally {uploadingRef.current = false}
  }
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
      active.current = false; setStatus(result.estado); const outcome = result.valoracion
        ? `Intento enviado. Valoración: ${result.valoracion.emoji ?? ''} ${result.valoracion.nombre}`
        : result.nota ? `Intento enviado. Nota: ${result.nota}` : 'Intento enviado. Pendiente de revisión docente.'
      setMessage(result.estado_planilla === 'pendiente' ? `${outcome} La nota todavía no está en la planilla; el docente debe revisar el vínculo o reintentar la transferencia.`
        : result.estado_planilla === 'nota_oficial_existente' ? `${outcome} Ya existe una nota oficial y no fue reemplazada.` : outcome)
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
      {attempt.duracion_minima_minutos > 0 && <> Tiempo mínimo antes de finalizar: {attempt.duracion_minima_minutos} minuto(s).</>}
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
      <QuestionMediaPreview media={(q.medios ?? []).filter(file => file.opcion_indice === null)} />
      {q.tipo === 'audio' || q.tipo === 'video' ? <div className='aula-answer-media'>
        <label className='form-label'>{q.tipo === 'audio' ? 'Subir respuesta de audio' : 'Subir respuesta de video'}
          <input className='form-control mt-2' type='file' accept={q.tipo === 'audio' ? 'audio/mpeg,audio/ogg,audio/webm' : 'video/mp4,video/webm'}
            disabled={uploadResponse.isPending || (!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token))}
            onChange={event => {const file = event.target.files?.[0]; event.currentTarget.value = ''
              if (file) void uploadAnswer(q, file)}} /></label>
        {typeof answers[q.token] === 'string' && answers[q.token] && <div className='mt-2'>Respuesta guardada: {q.tipo === 'audio'
          ? <audio controls preload='none' src={aulaRespuestaMedioUrl(answers[q.token] as string)} />
          : <video controls preload='metadata' src={aulaRespuestaMedioUrl(answers[q.token] as string)} />}</div>}
      </div>
      : q.tipo === 'abierta' ? <textarea className='form-control' rows={5} value={String(answers[q.token] ?? '')}
        disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
        onChange={event => setAnswers({...answers, [q.token]: event.target.value})} />
      : q.tipo === 'multiple' ? (q.opciones ?? []).map((option, optionIndex) => <label className='form-check mb-2' key={option}>
        <input className='form-check-input' type='checkbox' checked={Array.isArray(answers[q.token]) && answers[q.token].includes(option)}
          disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
          onChange={event => setAnswers({...answers, [q.token]: event.target.checked
            ? [...(Array.isArray(answers[q.token]) ? answers[q.token] as string[] : []), option]
            : (Array.isArray(answers[q.token]) ? answers[q.token] as string[] : []).filter(value => value !== option)})} />{option}
        <QuestionMediaPreview media={(q.medios ?? []).filter(file => file.opcion_indice === optionIndex)} /></label>)
      : q.tipo === 'unica' || q.tipo === 'booleano' ? (q.opciones?.length ? q.opciones : ['Verdadero', 'Falso']).map((option, optionIndex) =>
        <label className='form-check mb-2' key={option}><input className='form-check-input' type='radio' name={q.token}
          disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
          checked={answers[q.token] === option} onChange={() => setAnswers({...answers, [q.token]: option})} />{option}
          <QuestionMediaPreview media={(q.medios ?? []).filter(file => file.opcion_indice === optionIndex)} /></label>)
      : q.tipo === 'correspondencia' ? <div className='aula-attempt-pairs'>
        <p className='text-muted fs-7'>Relaciona cada elemento con su pareja. Las opciones de la derecha se presentan mezcladas.</p>
        {(q.opciones ?? []).map((left, leftIndex) => {const selected = Array.isArray(answers[q.token])
          ? answers[q.token] as string[] : (q.opciones ?? []).map(() => '')
          return <div className='aula-attempt-pair' key={`${q.token}-${leftIndex}`}>
            <span className='aula-question-number'>{leftIndex + 1}</span>
            <div><strong>{left}</strong><QuestionMediaPreview media={(q.medios ?? []).filter(file => file.opcion_indice === leftIndex)} /></div>
            <span className='aula-pair-arrow' aria-hidden='true'>→</span>
            <select className='form-select' aria-label={`Pareja de ${left}`}
              disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)} value={selected[leftIndex] ?? ''}
              onChange={event => setQuestionAnswer(q.token, selected.map((value, at) => at === leftIndex ? event.target.value : value))}>
              <option value=''>Selecciona la pareja</option>{(q.respuestas_disponibles ?? []).map(choice =>
                <option key={choice} value={choice} disabled={selected.some((value, at) => at !== leftIndex && value === choice)}>{choice}</option>)}</select>
          </div>})}</div>
      : q.tipo === 'orden' ? <div className='aula-attempt-order'>
        <p className='text-muted fs-7'>Coloca los elementos en el orden correcto usando las flechas.</p>
        {(Array.isArray(answers[q.token]) ? answers[q.token] as string[] : q.opciones ?? []).map((value, position, values) =>
          <div className='aula-attempt-order-row' key={value}><span className='aula-question-number'>{position + 1}</span>
            <span className='flex-grow-1'>{value}</span><div className='aula-question-tools'>
              <button className='btn btn-sm btn-light' type='button' aria-label={`Subir ${value}`} disabled={position === 0 ||
                (!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token))} onClick={() => {const next = [...values]
                ;[next[position - 1], next[position]] = [next[position], next[position - 1]]; setQuestionAnswer(q.token, next)}}>↑</button>
              <button className='btn btn-sm btn-light' type='button' aria-label={`Bajar ${value}`} disabled={position === values.length - 1 ||
                (!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token))} onClick={() => {const next = [...values]
                ;[next[position + 1], next[position]] = [next[position], next[position + 1]]; setQuestionAnswer(q.token, next)}}>↓</button>
            </div></div>)}
        {!Array.isArray(answers[q.token]) && <button className='btn btn-sm btn-light-success mt-3' type='button'
          onClick={() => setQuestionAnswer(q.token, q.opciones ?? [])}>Confirmar este orden</button>}
      </div>
      : <textarea className='form-control' rows={4} placeholder='Una respuesta por línea, en el orden correspondiente'
        disabled={!attempt.permitir_editar_respuestas && lockedAnswers.has(q.token)}
        value={Array.isArray(answers[q.token]) ? (answers[q.token] as string[]).join('\n') : ''}
        onChange={event => setAnswers({...answers, [q.token]: event.target.value.split('\n').filter(Boolean)})} />}
    </div>)}
    {status === 'en_curso' && <div className='d-flex flex-wrap gap-3'>
      {page > 1 && attempt.permitir_regresar && <button className='btn btn-light' disabled={changePage.isPending || save.isPending}
        onClick={() => void goPage(page - 1)}>← Página anterior</button>}
      {page < pageCount && <button className='btn btn-light-primary' disabled={changePage.isPending || save.isPending || uploadResponse.isPending}
        onClick={() => void goPage(page + 1)}>Guardar y avanzar →</button>}
      <button className='btn btn-light-success' disabled={save.isPending || uploadResponse.isPending}
        onClick={() => void persist().then(() => setMessage('Respuestas guardadas.'))
          .catch(error => setMessage(error instanceof Error ? error.message : 'No se pudieron guardar.'))}>Guardar respuestas</button>
      <button className='btn btn-success' disabled={finish.isPending || save.isPending || uploadResponse.isPending} onClick={() => void complete()}>Finalizar intento</button></div>}
    {message && <div className='alert alert-info mt-4'>{message}</div>}
  </section>
}

function QuestionReview({attempt, onSaved}: {attempt: Attempt; onSaved: () => void}) {
  const review = useRevisarPreguntas()
  const manual = attempt.preguntas.filter(question => ['abierta', 'audio', 'video'].includes(question.tipo))
  const [scores, setScores] = useState<Record<string, {puntos: string; retroalimentacion: string; criterios: string[]}>>(() =>
    Object.fromEntries(manual.map(question => [question.token, {
      puntos: attempt.revision_preguntas?.[question.token]?.puntos ?? '0',
      retroalimentacion: attempt.revision_preguntas?.[question.token]?.retroalimentacion ?? '',
      criterios: attempt.revision_preguntas?.[question.token]?.criterios ?? (question.rubrica ?? []).map(() => '0'),
    }])))
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const saveReview = async () => {
    setMessage('')
    try {
      await review.mutateAsync({token: attempt.token, version: attempt.version, motivo: reason,
        evaluaciones: manual.map(question => ({pregunta_token: question.token,
          puntos: scores[question.token]?.puntos ?? '0', retroalimentacion: scores[question.token]?.retroalimentacion ?? '',
          criterios: scores[question.token]?.criterios ?? []}))})
      onSaved()
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo guardar la revisión.')}
  }
  return <div className='aula-question-review'>
    {attempt.preguntas.map((question, index) => {
      const answer = attempt.respuestas[question.token]
      const isManual = ['abierta', 'audio', 'video'].includes(question.tipo)
      const form = scores[question.token]
      return <article className='aula-review-question' key={question.token}>
        <div className='d-flex flex-wrap align-items-center gap-2'><strong>{index + 1}. {question.enunciado}</strong>
          <span className='badge badge-light'>{question.tipo}</span><span className='text-muted'>{question.puntos} puntos</span></div>
        <QuestionMediaPreview media={question.medios ?? []} />
        {answer && (question.tipo === 'audio' || question.tipo === 'video') && typeof answer === 'string'
          ? <div className='my-3'>{question.tipo === 'audio'
            ? <audio controls preload='none' src={aulaRespuestaMedioUrl(answer)} />
            : <video controls preload='metadata' src={aulaRespuestaMedioUrl(answer)} />}</div>
          : <p className='mb-2 mt-3' style={{whiteSpace: 'pre-wrap'}}>Respuesta: {Array.isArray(answer)
            ? answer.join(' · ') : answer || 'Sin respuesta'}</p>}
        {isManual && form && <div className='aula-review-fields'>
          {(question.rubrica ?? []).map((criterion, criterionIndex) => <label key={criterionIndex}>
            {criterion.nombre} (máximo {criterion.puntos})
            <input type='number' min='0' max={criterion.puntos} step='0.01' className='form-control'
              disabled={attempt.estado !== 'pendiente_revision'} value={form.criterios[criterionIndex] ?? '0'}
              onChange={event => {const criteria = [...form.criterios]; criteria[criterionIndex] = event.target.value
                const total = Math.round(criteria.reduce((sum, value) => sum + (Number(value) || 0), 0) * 10000) / 10000
                setScores({...scores, [question.token]: {...form, criterios: criteria, puntos: String(total)}})}} />
          </label>)}
          <label>Puntos otorgados (máximo {question.puntos})
            <input type='number' min='0' max={question.puntos} step='0.01' className='form-control'
              readOnly={!!question.rubrica?.length} disabled={attempt.estado !== 'pendiente_revision'}
              value={form.puntos} onChange={event => setScores({...scores,
                [question.token]: {...form, puntos: event.target.value}})} /></label>
          <label>Retroalimentación
            <textarea className='form-control' rows={2} maxLength={5000} disabled={attempt.estado !== 'pendiente_revision'}
              value={form.retroalimentacion} onChange={event => setScores({...scores,
                [question.token]: {...form, retroalimentacion: event.target.value}})} /></label>
        </div>}
      </article>
    })}
    {attempt.estado === 'pendiente_revision' && <div className='aula-review-submit'>
      <label>Motivo de la revisión
        <input className='form-control' minLength={8} maxLength={1000} value={reason}
          onChange={event => setReason(event.target.value)} placeholder='Describe por qué confirmas esta calificación' /></label>
      <button type='button' className='btn btn-success' disabled={review.isPending || reason.trim().length < 8}
        onClick={() => void saveReview()}>Guardar revisión y calcular nota</button>
    </div>}
    {message && <div className='alert alert-danger mt-3' role='alert'>{message}</div>}
  </div>
}

function QuizPanel({token, canEdit, canGrade, canReactivate, canLinkGradebook, hasAttempts, current, version, scale, canInteract, isStudent}: {
  token: string; canEdit: boolean; canGrade: boolean; canReactivate: boolean; canLinkGradebook: boolean;
  hasAttempts: boolean; current: Question[]; version: number;
  scale?: AulaScale; canInteract?: boolean; isStudent: boolean}) {
  const start = useIniciarIntento()
  const [attemptToken, setAttemptToken] = useState('')
  const own = useMiIntento(token, isStudent)
  const attempt = useIntento(attemptToken)
  useEffect(() => {if (own.data?.token && !attemptToken) setAttemptToken(own.data.token)}, [own.data?.token, attemptToken])
  const attempts = useIntentos(token, canGrade)
  const reactivate = useReactivarIntento()
  const retryGradebook = useReintentarPlanilla()
  const grade = useCalificarIntento()
  const [grades, setGrades] = useState<Record<string, string>>({})
  const [reviewToken, setReviewToken] = useState('')
  const review = useIntento(reviewToken)
  const [message, setMessage] = useState('')
  return <>
    {canEdit || canGrade ? <>{canEdit && <AulaQuestionBuilder token={token} current={current} version={version} locked={hasAttempts}
      lockReason='Este cuestionario ya tiene intentos. Sus preguntas históricas son de solo lectura.' />}
      {canGrade && <section className='mt-8'><h3>Intentos</h3>{attempts.data?.length ? attempts.data.map(item => <div className='aula-resource-item' key={item.token}>
        <strong className='flex-grow-1'>{item.estudiante} · intento {item.numero}</strong><span>{item.estado} · Incidentes: {item.incidentes} · Nota: {item.nota ?? 'Pendiente'}
          {item.estado_planilla === 'pendiente' && ' · Planilla pendiente'}
          {item.estado_planilla === 'nota_oficial_existente' && ' · Ya existe nota oficial'}</span>
        <button type='button' className='btn btn-sm btn-light-primary' onClick={() => setReviewToken(item.token)}>Revisar respuestas</button>
        {item.estado_planilla === 'pendiente' && canEdit && canLinkGradebook && <button type='button' className='btn btn-sm btn-light-warning'
          disabled={retryGradebook.isPending} onClick={() => {
            const motivo = window.prompt('Motivo del reintento (mínimo 8 caracteres):')
            if (motivo) void retryGradebook.mutateAsync({token: item.token, motivo})
              .then(() => setMessage('Nota incorporada a la planilla.'))
              .catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo reintentar la transferencia.'))
          }}>Reintentar planilla</button>}
        {['finalizado', 'tiempo_agotado'].includes(item.estado) && <div className='d-flex gap-2 align-items-center'>
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
        {item.estado === 'bloqueado' && canReactivate && <button className='btn btn-sm btn-light-success' disabled={reactivate.isPending} onClick={() => {
          const motivo = window.prompt('Motivo de reactivación (mínimo 8 caracteres):')
          if (motivo) void reactivate.mutateAsync({token: item.token, motivo}).then(() => setMessage('Intento reactivado.'))
            .catch(error => setMessage(error instanceof Error ? error.message : 'No se pudo reactivar.'))
        }}>Reactivar</button>}</div>) : <p className='text-muted'>No hay intentos todavía.</p>}
        {reviewToken && <div className='border rounded p-5 mt-5'><div className='d-flex justify-content-between align-items-center gap-3'>
          <h4 className='mb-0'>Respuestas del intento</h4><button className='btn btn-sm btn-light' onClick={() => setReviewToken('')}>Cerrar</button></div>
          {review.isLoading ? <p className='mt-4'>Cargando respuestas…</p> : review.data
            ? <QuestionReview key={review.data.token} attempt={review.data} onSaved={() => setReviewToken('')} />
            : <p className='text-danger mt-4'>No se pudieron cargar las respuestas.</p>}</div>}</section>}</>
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
  const aula = useAula(data?.aula_token ?? '')
  const {mutate: markOpened} = useAbrirRecurso()
  const openingTokens = useRef(new Set<string>())
  const upload = useSubirAdjunto()
  const linkGradebook = useVincularPlanilla()
  const [uploadMessage, setUploadMessage] = useState('')
  const [linkMessage, setLinkMessage] = useState('')
  useEffect(() => {
    if (data?.estudiante && data.progreso === 'sin_iniciar' && data.completar_al === 'abrir'
      && !openingTokens.current.has(recursoToken)) {
      openingTokens.current.add(recursoToken)
      markOpened(recursoToken, {onError: () => openingTokens.current.delete(recursoToken)})
    }
  }, [data?.estudiante, data?.progreso, data?.completar_al, recursoToken, markOpened])
  if (isLoading) return <div className='card card-body'>Cargando recurso…</div>
  if (error || !data) return <div className='alert alert-danger'>No se pudo abrir este recurso. {error?.message}</div>
  if (aula.isLoading) return <div className='card card-body' role='status'>Cargando aula…</div>
  if (!aula.data) return <div className='alert alert-danger'>No se pudo cargar la navegación del aula.</div>
  const canManage = data.puede_gestionar === true
  const section = aula.data.secciones.find(item => item.token === data.seccion_token)
  const period = aula.data.periodos.find(item => item.token === section?.periodo_token)
  const canChangeFiles = data.puede_adjuntar === true &&
    (period?.estado !== 'cerrado' || aula.data.permitir_edicion_periodos_cerrados)
  const scheduled = data.estudiante === true && data.no_disponible === 'programado'
  return <AulaWorkspace aula={aula.data} activeResource={recursoToken}><div className='aula-resource-page'>
    <button className='btn btn-link p-0 mb-4' onClick={() => navigate(`/evaluacion/aula/${data.aula_token}`)}>← Contenido del aula</button>
    <div className='d-flex flex-wrap align-items-center gap-3'><span className={`aula-resource-kind aula-resource-kind-${data.tipo}`}>
      {{texto: 'Lectura', archivo: 'Material', tarea: 'Tarea', cuestionario: 'Cuestionario'}[data.tipo]}</span>
      <h2 className='mb-0 flex-grow-1'>{data.titulo}</h2>
      {canManage && <button className='btn btn-light-warning' onClick={() => navigate(`/evaluacion/aula/${data.aula_token}?editar=${recursoToken}`)}>
        Editar recurso</button>}</div>
    <div className='aula-resource-facts'>
      <div className='aula-resource-fact'><span>Evaluación</span><strong>{data.calificable ? 'Calificable' : 'No calificable'}</strong>
        {data.estado_vinculo_planilla === 'vinculado' && <small>Vinculado a la planilla</small>}
        {data.estado_vinculo_planilla === 'pendiente_apertura' && <small>Vínculo pendiente: el período aún no está abierto.</small>}
        {data.estado_vinculo_planilla === 'pendiente_configuracion' && <small>Vínculo pendiente: revisa la configuración o la asignación docente.</small>}</div>
      {scheduled ? <>
        <div className='aula-resource-fact'><span>Disponible desde</span><strong>{data.disponible_desde
          ? schoolDate(data.disponible_desde, data.zona_publicacion) : 'Sin fecha definida'}</strong></div>
        <div className='aula-resource-fact'><span>Disponible hasta</span><strong>{data.disponible_hasta
          ? schoolDate(data.disponible_hasta, data.zona_publicacion) : 'Sin límite de fecha'}</strong></div>
      </> : <div className='aula-resource-fact'><span>Disponibilidad</span>
        {!data.disponible_desde && !data.disponible_hasta ? <strong>Disponible sin límite de fecha</strong> : <>
          {data.disponible_desde && <strong>Desde {schoolDate(data.disponible_desde, data.zona_publicacion)}</strong>}
          {data.disponible_hasta && <strong>Hasta {schoolDate(data.disponible_hasta, data.zona_publicacion)}</strong>}
        </>}</div>}
    </div>
    {scheduled ? <section className='aula-unavailable' role='status' aria-live='polite'>
      <div className='aula-unavailable-illustration' aria-hidden='true'>
        <div className='aula-unavailable-calendar'><span /><span /><div className='aula-unavailable-calendar-grid'>
          {Array.from({length: 9}, (_, index) => <i key={index} />)}</div></div>
        <div className='aula-unavailable-clock'><span /></div>
      </div>
      <h3>Este recurso aún no está disponible</h3>
      <p>{data.disponible_desde ? `Podrás abrirlo desde el ${schoolDate(data.disponible_desde, data.zona_publicacion)}.`
        : 'Podrás abrirlo cuando el docente lo habilite.'}</p>
    </section> : <>
    {data.estado_vinculo_planilla === 'pendiente_configuracion' && data.puede_planilla &&
      <div className='d-flex flex-wrap align-items-center gap-3 mt-3'><button className='btn btn-light-primary'
        disabled={linkGradebook.isPending} onClick={() => void linkGradebook.mutateAsync(recursoToken)
          .then(() => setLinkMessage('Actividad vinculada a la planilla.'))
          .catch(error => setLinkMessage(error instanceof Error ? error.message : 'No se pudo vincular la planilla.'))}>
        Reintentar vínculo con planilla</button>{linkMessage && <span role='status'>{linkMessage}</span>}</div>}
    {data.contenido?.html !== null && data.contenido?.html !== undefined
      ? <div className='aula-rich-content aula-resource-content'
          dangerouslySetInnerHTML={{__html: data.contenido.html}} />
      : <Blocks blocks={data.contenido?.bloques ?? []} />}
    {!!data.adjuntos?.length && <div className='mt-6'><h3>Archivos adjuntos</h3>
      <AulaAttachmentGallery files={data.adjuntos} canRemove={canChangeFiles} /></div>}
    {canManage && !canChangeFiles && <div className='alert alert-danger mt-4'>El período está cerrado. Puedes consultar los archivos, pero no modificarlos.</div>}
    {canChangeFiles && <div className='mt-5'><label className='form-label'>Agregar archivo a este recurso<input className='form-control' type='file'
      disabled={upload.isPending} onChange={event => {const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void upload.mutateAsync({token: recursoToken,
        archivo: file, destino: 'recursos'}).then(() => setUploadMessage('Archivo agregado.')).catch(error => setUploadMessage(error instanceof Error ? error.message : 'No se pudo agregar.'))}} /></label>
      {uploadMessage && <div className='alert alert-info mt-2'>{uploadMessage}</div>}</div>}
    {data.tipo === 'tarea' && <TaskPanel key={recursoToken} token={recursoToken}
      canManage={data.puede_calificar === true} isStudent={data.estudiante === true}
      gradeable={data.calificable} existing={data.entrega} scale={data.escala}
      reasonRequired={data.requiere_motivo} canInteract={data.puede_interactuar} reenvios={data.reenvios} />}
    {data.tipo === 'cuestionario' && <QuizPanel token={recursoToken} canEdit={data.puede_evaluar === true}
      canGrade={data.puede_calificar_cuestionario === true} canReactivate={data.puede_reactivar_intento === true}
      canLinkGradebook={data.puede_planilla === true} hasAttempts={data.tiene_intentos === true}
      isStudent={data.estudiante === true} current={data.preguntas ?? []} version={data.version} scale={data.escala}
      canInteract={data.puede_interactuar} />}
    </>}
  </div></AulaWorkspace>
}
