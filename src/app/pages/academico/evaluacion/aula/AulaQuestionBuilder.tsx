import {useState, type FormEvent} from 'react'
import {aulaPreguntaMedioUrl, type Question, type QuestionMedia, useGuardarPreguntas,
  useQuitarMedioPregunta, useSubirMedioPregunta} from './aula.api'

type Draft = {id: string; token?: string; tipo: string; enunciado: string; opciones: string[];
  respuesta: string | string[]; puntos: string; puntajes: Record<string, string> | null;
  rubrica: {nombre: string; puntos: string}[]; medios: QuestionMedia[]}
const labels: Record<string, string> = {unica: 'Opción única', multiple: 'Opción múltiple', booleano: 'Verdadero o falso',
  correspondencia: 'Emparejamiento', orden: 'Ordenamiento', abierta: 'Respuesta abierta',
  audio: 'Respuesta de audio', video: 'Respuesta de video'}
const newQuestion = (): Draft => ({id: crypto.randomUUID(), tipo: 'unica', enunciado: '', opciones: ['', ''],
  respuesta: '', puntos: '1', puntajes: null, rubrica: [], medios: []})
const fromCurrent = (current: Question[]): Draft[] => current.map(item => ({id: item.token, token: item.token, tipo: item.tipo,
  enunciado: item.enunciado, opciones: item.opciones ?? [], respuesta: item.respuesta_correcta?.valor ?? '',
  puntos: item.puntos, puntajes: item.puntajes_opciones ?? null, rubrica: item.rubrica ?? [], medios: item.medios ?? []}))

export function QuestionMediaList({medios, canRemove, onRemove}: {medios: QuestionMedia[];
  canRemove?: boolean; onRemove?: (token: string) => void}) {
  return <div className='aula-question-media-list'>{medios.map(medium => <div className='aula-question-media' key={medium.token}>
    {medium.mime.startsWith('image/') ? <img src={aulaPreguntaMedioUrl(medium.token)} alt={medium.nombre} />
      : medium.mime.startsWith('audio/') ? <audio controls src={aulaPreguntaMedioUrl(medium.token)} />
        : <video controls preload='metadata' src={aulaPreguntaMedioUrl(medium.token)} />}
    <span>{medium.nombre}</span>{canRemove && <button type='button' className='btn btn-sm btn-light-danger'
      onClick={() => onRemove?.(medium.token)}>Quitar</button>}</div>)}</div>
}

export function AulaQuestionBuilder({token, current, version, locked, lockReason}: {
  token: string; current: Question[]; version: number; locked: boolean; lockReason?: string}) {
  const save = useGuardarPreguntas()
  const uploadMedium = useSubirMedioPregunta()
  const removeMedium = useQuitarMedioPregunta()
  const [savedVersion, setSavedVersion] = useState(version)
  const [questions, setQuestions] = useState<Draft[]>(() => fromCurrent(current))
  const [active, setActive] = useState(0)
  const [message, setMessage] = useState('')
  const item = questions[active]
  const total = questions.reduce((sum, q) => sum + (Number(q.puntos) || 0), 0)
  const update = (patch: Partial<Draft>) => setQuestions(current => current.map((q, at) => at === active ? {...q, ...patch} : q))
  const add = () => {setQuestions(current => [...current, newQuestion()]); setActive(questions.length)}
  const duplicate = () => {if (!item) return; setQuestions(current => [...current.slice(0, active + 1),
    {...item, id: crypto.randomUUID(), token: undefined, medios: []}, ...current.slice(active + 1)]); setActive(active + 1)}
  const remove = () => {if (questions.length <= 1) return
    setQuestions(current => current.filter((_, at) => at !== active)); setActive(Math.max(0, active - 1))}
  const move = (delta: number) => {
    const target = active + delta
    if (target < 0 || target >= questions.length) return
    setQuestions(current => {const next = [...current]; [next[active], next[target]] = [next[target], next[active]]; return next})
    setActive(target)
  }
  const setOption = (index: number, value: string) => {
    const previous = item.opciones[index]
    update({opciones: item.opciones.map((option, at) => at === index ? value : option),
      puntajes: item.puntajes ? Object.fromEntries(Object.entries(item.puntajes)
        .map(([option, points]) => [option === previous ? value : option, points])) : null,
      respuesta: Array.isArray(item.respuesta) ? item.respuesta.map(answer => answer === previous ? value : answer)
        : item.respuesta === previous && previous ? value : item.respuesta})
  }
  const removeOption = (index: number) => {
    const value = item.opciones[index]
    update({opciones: item.opciones.filter((_, at) => at !== index),
      puntajes: item.puntajes ? Object.fromEntries(Object.entries(item.puntajes).filter(([option]) => option !== value)) : null,
      respuesta: Array.isArray(item.respuesta) ? item.respuesta.filter(answer => answer !== value)
        : item.respuesta === value ? '' : item.respuesta})
  }
  const toggleAnswer = (value: string) => {
    const selected = Array.isArray(item.respuesta) ? item.respuesta : []
    update({respuesta: selected.includes(value) ? selected.filter(answer => answer !== value) : [...selected, value]})
  }
  const pairAnswers = Array.isArray(item?.respuesta) ? item.respuesta : []
  const setPair = (index: number, side: 'left' | 'right', value: string) => {
    if (side === 'left') update({opciones: item.opciones.map((entry, at) => at === index ? value : entry)})
    else update({respuesta: item.opciones.map((_, at) => at === index ? value : pairAnswers[at] ?? '')})
  }
  const orderItems = item?.tipo === 'orden' && Array.isArray(item.respuesta) ? item.respuesta : item?.opciones ?? []
  const setOrderItems = (values: string[]) => update({opciones: values, respuesta: values})
  const moveOrderItem = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= orderItems.length) return
    const next = [...orderItems]; [next[index], next[target]] = [next[target], next[index]]
    setOrderItems(next)
  }
  const addMedium = async (file: File, optionIndex?: number) => {
    if (!item.token) {setMessage('Guarda la pregunta antes de adjuntar medios.'); return}
    setMessage('')
    try {const medium = await uploadMedium.mutateAsync({pregunta: item.token, archivo: file, opcion_indice: optionIndex})
      update({medios: [...item.medios, medium]})
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo subir el medio.')}
  }
  const deleteMedium = async (mediumToken: string) => {
    try {await removeMedium.mutateAsync(mediumToken)
      update({medios: item.medios.filter(medium => medium.token !== mediumToken)})
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudo quitar el medio.')}
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    try {const result = await save.mutateAsync({token, version: savedVersion, preguntas: questions.map(question => ({token: question.token,
      tipo: question.tipo,
      enunciado: question.enunciado.trim(), opciones: question.opciones.map(option => option.trim()).filter(Boolean),
      respuesta_correcta: ['abierta', 'audio', 'video'].includes(question.tipo) ? null : {valor: Array.isArray(question.respuesta)
        ? question.respuesta.map(value => value.trim()).filter(Boolean) : question.respuesta.trim()}, puntos: question.puntos,
      puntajes_opciones: question.puntajes, rubrica: question.rubrica}))})
      setSavedVersion(result.version)
      setQuestions(fromCurrent(result.preguntas))
      setMessage('Preguntas guardadas.')
    } catch (error) {setMessage(error instanceof Error ? error.message : 'No se pudieron guardar las preguntas.')}
  }

  return <section className='aula-question-builder mt-8'>
    <div className='aula-question-header'><div><span className='aula-eyebrow'>Evaluación</span>
      <h3 className='mb-1'>Preguntas del cuestionario</h3>
      <p className='text-muted mb-0'>{questions.length} preguntas · {total.toLocaleString('es-CO')} puntos</p></div>
      {!locked && <button className='btn btn-light-success' type='button' onClick={add}>+ Agregar pregunta</button>}</div>
    {locked && <div className='alert alert-light mt-4'>{lockReason ?? 'Las preguntas son de solo lectura.'}</div>}
    <div className='aula-question-layout'>
      <nav className='aula-question-index' aria-label='Preguntas del cuestionario'>
        {questions.map((question, index) => <button type='button' key={question.id}
          className={active === index ? 'is-active' : ''} onClick={() => setActive(index)}>
          <span className='aula-question-number'>{index + 1}</span><span className='aula-question-index-copy'>
            <strong>{question.enunciado || `Pregunta ${index + 1}`}</strong>
            <small>{labels[question.tipo] ?? question.tipo} · {question.puntos} puntos</small></span></button>)}
        {!questions.length && <p className='text-muted p-4 mb-0'>Agrega la primera pregunta.</p>}
      </nav>
      <div className='aula-question-stage'>{item ? <form onSubmit={event => void submit(event)}>
        <div className='aula-question-stage-head'><div><span className='aula-question-number'>{active + 1}</span>
          <strong>Pregunta {active + 1}</strong></div>
          {!locked && <div className='aula-question-tools'>
            <button type='button' className='btn btn-sm btn-light' disabled={active === 0}
              aria-label='Subir pregunta' onClick={() => move(-1)}>↑</button>
            <button type='button' className='btn btn-sm btn-light' disabled={active === questions.length - 1}
              aria-label='Bajar pregunta' onClick={() => move(1)}>↓</button>
            <button type='button' className='btn btn-sm btn-light-primary' onClick={duplicate}>Duplicar</button>
            <button type='button' className='btn btn-sm btn-light-danger' disabled={questions.length <= 1}
              title={questions.length <= 1 ? 'El cuestionario necesita al menos una pregunta' : undefined}
              onClick={remove}>Quitar</button></div>}</div>
        <fieldset disabled={locked} className='aula-question-fields'>
          <div className='row g-4'><div className='col-md-8'><label className='form-label'>Tipo de respuesta
            <select className='form-select mt-2' value={item.tipo}
              onChange={event => {const tipo = event.target.value
                update({tipo, respuesta: tipo === 'multiple' ? [] : tipo === 'orden' ? item.opciones
                  : tipo === 'correspondencia' ? item.opciones.map(() => '') : ''})}}>
              {Object.entries(labels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select>
          </label></div><div className='col-md-4'><label className='form-label'>Puntos de la pregunta
            <input className='form-control mt-2' type='number' min='0.001' max='100' step='0.001' required value={item.puntos}
              onChange={event => update({puntos: event.target.value})} />
            <small className='text-muted'>Máximo que esta pregunta aporta al total del cuestionario.</small></label></div></div>
          <label className='form-label mt-5'>Enunciado
            <textarea className='form-control mt-2' rows={4} required value={item.enunciado}
              onChange={event => update({enunciado: event.target.value})} /></label>
          <div className='aula-question-attachments mt-4'><strong>Medios de la pregunta</strong>
            <p className='text-muted fs-7 mb-2'>Imagen, audio o video. Guarda primero la pregunta para adjuntarlos.</p>
            <QuestionMediaList medios={item.medios.filter(medium => medium.opcion_indice === null)}
              canRemove={!locked} onRemove={mediumToken => void deleteMedium(mediumToken)} />
            {!locked && <label className='btn btn-sm btn-light-primary mt-2'>+ Adjuntar medio
              <input className='visually-hidden' type='file' accept='image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/webm,video/mp4,video/webm'
                disabled={!item.token || uploadMedium.isPending} onChange={event => {const file = event.target.files?.[0]
                  event.target.value = ''; if (file) void addMedium(file)}} /></label>}</div>
          {(item.tipo === 'unica' || item.tipo === 'multiple') && <div className='aula-answer-editor mt-5'>
            <div className='d-flex justify-content-between align-items-center gap-3 mb-3'><strong>Respuestas</strong>
              <span className='text-muted fs-7'>Marca {item.tipo === 'unica' ? 'la correcta' : 'todas las correctas'}</span></div>
            {item.opciones.map((option, index) => <div className={`aula-answer-row ${Array.isArray(item.respuesta)
              ? item.respuesta.includes(option) && option ? 'is-correct' : '' : item.respuesta === option && option ? 'is-correct' : ''}`}
              key={index}>
              <input type={item.tipo === 'multiple' ? 'checkbox' : 'radio'} name={`respuesta-${item.id}`}
                aria-label={`Respuesta correcta ${index + 1}`} checked={Array.isArray(item.respuesta)
                  ? item.respuesta.includes(option) && !!option : item.respuesta === option && !!option}
                disabled={!option.trim()} onChange={() => item.tipo === 'multiple' ? toggleAnswer(option) : update({respuesta: option})} />
              <input className='form-control' value={option} aria-label={`Opción ${index + 1}`}
                onChange={event => setOption(index, event.target.value)} placeholder={`Opción ${index + 1}`} />
              <button className='btn btn-sm btn-light-danger' type='button' aria-label={`Quitar opción ${index + 1}`}
                disabled={item.opciones.length <= 2} onClick={() => removeOption(index)}>×</button>
              {item.puntajes && <label className='aula-option-points'>Puntos<input className='form-control' type='number' min='0'
                max={item.puntos} step='0.001' value={item.puntajes[option] ?? '0'}
                onChange={event => update({puntajes: {...item.puntajes, [option]: event.target.value}})} /></label>}
              <div className='aula-option-media'><QuestionMediaList medios={item.medios.filter(medium => medium.opcion_indice === index)}
                canRemove={!locked} onRemove={mediumToken => void deleteMedium(mediumToken)} />
                {!locked && <label className='btn btn-sm btn-light-primary'>+ Medio
                  <input className='visually-hidden' type='file' accept='image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/webm,video/mp4,video/webm'
                    disabled={!item.token || uploadMedium.isPending || !option.trim()} onChange={event => {const file = event.target.files?.[0]
                      event.target.value = ''; if (file) void addMedium(file, index)}} /></label>}</div></div>)}
            <button type='button' className='btn btn-sm btn-light-primary mt-3'
              onClick={() => update({opciones: [...item.opciones, '']})}>+ Agregar respuesta</button>
          </div>}
          {item.tipo === 'booleano' && <div className='aula-answer-editor mt-5'><strong>Respuesta correcta</strong>
            <div className='d-flex gap-3 mt-3'>{['Verdadero', 'Falso'].map(value => <label key={value}
              className={`aula-boolean-choice ${item.respuesta === value ? 'is-correct' : ''}`}>
              <input type='radio' name={`bool-${item.id}`} checked={item.respuesta === value}
                onChange={() => update({respuesta: value})} />{value}
              {item.puntajes && <input className='form-control' type='number' min='0' max={item.puntos} step='0.001'
                aria-label={`Puntos para ${value}`} value={item.puntajes[value] ?? '0'}
                onChange={event => update({puntajes: {...item.puntajes, [value]: event.target.value}})} />}</label>)}</div></div>}
          {['unica', 'multiple', 'booleano'].includes(item.tipo) && <label className='form-check form-switch mt-4'>
            <input className='form-check-input' type='checkbox' checked={item.puntajes !== null}
              onChange={event => update({puntajes: event.target.checked ? {} : null})} />Puntaje diferenciado por respuesta</label>}
          {item.tipo === 'correspondencia' && <div className='aula-structure-editor mt-5'>
            <strong>Pares de correspondencia</strong><p className='text-muted fs-7 mt-1'>Cada fila indica la pareja correcta. Al presentar el examen, las opciones de la derecha se mezclan y el estudiante debe unirlas.</p>
            <div className='aula-pair-list'>{item.opciones.map((left, index) => <div className='aula-pair-row' key={index}>
              <div><label className='form-label'><span>Elemento {index + 1} · izquierda</span><input className='form-control mt-2'
                value={left} maxLength={1000} placeholder='Concepto o pregunta' onChange={event => setPair(index, 'left', event.target.value)} /></label>
                <QuestionMediaList medios={item.medios.filter(medium => medium.opcion_indice === index)} canRemove={!locked}
                  onRemove={mediumToken => void deleteMedium(mediumToken)} />
                {!locked && <span className='aula-option-media'><label className='btn btn-sm btn-light-primary mt-2'>+ Imagen, audio o video
                  <input className='visually-hidden' type='file' accept='image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/webm,video/mp4,video/webm'
                    disabled={!item.token || uploadMedium.isPending || !left.trim()} onChange={event => {const file = event.target.files?.[0]
                      event.target.value = ''; if (file) void addMedium(file, index)}} /></label></span>}</div>
              <span className='aula-pair-arrow' aria-hidden='true'>→</span>
              <label className='form-label'><span>Pareja correcta · derecha</span><input className='form-control mt-2'
                value={pairAnswers[index] ?? ''} maxLength={1000} placeholder='Respuesta correspondiente'
                onChange={event => setPair(index, 'right', event.target.value)} /></label>
              {!locked && <button className='btn btn-sm btn-light-danger' type='button' aria-label={`Quitar par ${index + 1}`}
                disabled={item.opciones.length <= 2} onClick={() => update({opciones: item.opciones.filter((_, at) => at !== index),
                  respuesta: pairAnswers.filter((_, at) => at !== index)})}>Quitar</button>}
            </div>)}</div>
            {!locked && <button className='btn btn-sm btn-light-primary mt-3' type='button' onClick={() => update({
              opciones: [...item.opciones, ''], respuesta: [...pairAnswers, '']})}>+ Agregar par</button>}
          </div>}
          {item.tipo === 'orden' && <div className='aula-structure-editor mt-5'>
            <strong>Orden correcto</strong><p className='text-muted fs-7 mt-1'>Escribe los pasos en su secuencia correcta. Al estudiante se le mostrarán mezclados para que los ordene.</p>
            <div className='aula-order-list'>{orderItems.map((value, index) => <div className='aula-order-row' key={index}>
              <span className='aula-question-number'>{index + 1}</span><input className='form-control' value={value}
                maxLength={1000} aria-label={`Paso ${index + 1}`} placeholder={`Paso ${index + 1}`}
                onChange={event => setOrderItems(orderItems.map((entry, at) => at === index ? event.target.value : entry))} />
              {!locked && <div className='aula-question-tools'><button className='btn btn-sm btn-light' type='button'
                aria-label={`Subir paso ${index + 1}`} disabled={index === 0} onClick={() => moveOrderItem(index, -1)}>↑</button>
                <button className='btn btn-sm btn-light' type='button' aria-label={`Bajar paso ${index + 1}`}
                  disabled={index === orderItems.length - 1} onClick={() => moveOrderItem(index, 1)}>↓</button>
                <button className='btn btn-sm btn-light-danger' type='button' aria-label={`Quitar paso ${index + 1}`}
                  disabled={orderItems.length <= 2} onClick={() => setOrderItems(orderItems.filter((_, at) => at !== index))}>Quitar</button></div>}
            </div>)}</div>
            {!locked && <button className='btn btn-sm btn-light-primary mt-3' type='button'
              onClick={() => setOrderItems([...orderItems, ''])}>+ Agregar paso</button>}
          </div>}
          {['abierta', 'audio', 'video'].includes(item.tipo) && <div className='aula-rubric-editor mt-5'>
            <p className='aula-rich-note'>{item.tipo === 'abierta' ? 'La respuesta escrita' : `La respuesta de ${item.tipo}`} se revisa por pregunta después del intento.</p>
            <div className='d-flex justify-content-between align-items-center'><strong>Rúbrica opcional</strong>
              {!locked && <button className='btn btn-sm btn-light-primary' type='button'
                onClick={() => update({rubrica: [...item.rubrica, {nombre: '', puntos: '1'}]})}>+ Criterio</button>}</div>
            {item.rubrica.map((criterion, index) => <div className='d-flex gap-3 align-items-end mt-3' key={index}>
              <label className='form-label flex-grow-1'>Criterio<input className='form-control mt-1' maxLength={160}
                value={criterion.nombre} onChange={event => update({rubrica: item.rubrica.map((entry, at) => at === index
                  ? {...entry, nombre: event.target.value} : entry)})} /></label>
              <label className='form-label'>Máximo<input className='form-control mt-1' type='number' min='0.001'
                max={item.puntos} step='0.001' value={criterion.puntos}
                onChange={event => update({rubrica: item.rubrica.map((entry, at) => at === index
                  ? {...entry, puntos: event.target.value} : entry)})} /></label>
              {!locked && <button className='btn btn-sm btn-light-danger mb-2' type='button'
                onClick={() => update({rubrica: item.rubrica.filter((_, at) => at !== index)})}>Quitar</button>}</div>)}
          </div>}
        </fieldset>
        {!locked && <div className='aula-form-actions'><span className='text-muted fs-7 me-auto'>Guarda la lista completa al terminar de editar.</span>
          <button className='btn btn-success' disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar preguntas'}</button></div>}
        {message && <div className='alert alert-info mt-4' role='status'>{message}</div>}
      </form> : <div className='aula-question-empty'><h4>Organiza tu evaluación</h4>
        <p>Las preguntas aparecerán aquí para que puedas redactarlas y asignarles puntaje.</p></div>}</div>
    </div>
  </section>
}
