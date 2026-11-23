import {useCallback, useEffect, useRef, useState, type FormEvent} from 'react'

type RecordDetails = {colegio: string; numero: string; fecha_expedicion: string}
type Result = {kind: 'ready' | 'loading'} | {kind: 'error'; message: string} | {kind: 'confirmed'; data: RecordDetails}

export default function VerifyCertificate() {
  const [code, setCode] = useState(() => window.location.hash.slice(1))
  const [result, setResult] = useState<Result>({kind: 'ready'})
  const active = useRef<AbortController | null>(null)
  const verify = useCallback(async (value: string) => {
    active.current?.abort()
    if (!/^[0-9a-f]{24}$/i.test(value.replace(/[ -]/g, ''))) {
      setResult({kind: 'error', message: 'Revisa el código de verificación impreso junto al QR.'})
      return
    }
    const request = new AbortController()
    active.current = request
    setResult({kind: 'loading'})
    try {
      const response = await fetch('/api/constancias/verificar', {method: 'POST', credentials: 'omit',
        headers: {Accept: 'application/json', 'Content-Type': 'application/json'}, body: JSON.stringify({codigo: value}), signal: request.signal})
      if (!response.ok) {
        const message = response.status === 404 ? 'Este colegio no tiene una constancia registrada con ese código.'
          : response.status === 429 ? 'Has hecho varias consultas. Espera un minuto y vuelve a intentarlo.'
          : 'No se pudo consultar el registro. Inténtalo de nuevo.'
        throw new Error(message)
      }
      const {data} = await response.json()
      if (!request.signal.aborted) setResult({kind: 'confirmed', data})
    } catch (error) {
      if (!request.signal.aborted) setResult({kind: 'error', message: error instanceof Error && !(error instanceof TypeError)
        ? error.message : 'Revisa tu conexión y vuelve a intentarlo.'})
    }
  }, [])

  useEffect(() => {
    function readLink() {
      const value = window.location.hash.slice(1)
      active.current?.abort()
      setCode(value)
      if (value) void verify(value)
      else setResult({kind: 'ready'})
    }
    readLink()
    window.addEventListener('hashchange', readLink)
    return () => {active.current?.abort(); window.removeEventListener('hashchange', readLink)}
  }, [verify])

  function submit(event: FormEvent) {
    event.preventDefault()
    void verify(code)
  }
  return <main className='container py-12 px-4'>
    <section className='card mx-auto shadow-sm' style={{maxWidth: '36rem'}}>
      <div className='card-body p-6 p-sm-9'>
        <h1 className='mb-3'>Verificar constancia</h1>
        <p className='mb-6'>Consulta el registro de emisión con el código que aparece junto al QR.</p>
        <form onSubmit={submit}>
          <label className='form-label' htmlFor='certificate-code'>Código de verificación</label>
          <input id='certificate-code' className='form-control font-monospace' value={code} maxLength={64} required
            autoComplete='off' autoCapitalize='characters' spellCheck={false} onChange={event => {
              active.current?.abort(); setCode(event.target.value); setResult({kind: 'ready'})
            }} />
          <button className='btn btn-primary mt-4' disabled={result.kind === 'loading'}>{result.kind === 'loading' ? 'Consultando…' : 'Verificar'}</button>
        </form>
        <div aria-live='polite' aria-atomic='true'>
          {result.kind === 'error' && <p className='alert alert-danger mt-5 mb-0'>{result.message}</p>}
          {result.kind === 'confirmed' && <section className='border-top pt-5 mt-5'>
            <h2 className='h4 mb-4'>Constancia emitida por el colegio</h2>
            <dl className='mb-0'><dt>Colegio emisor</dt><dd>{result.data.colegio}</dd>
              <dt>Constancia de promoción anticipada</dt><dd>{result.data.numero}</dd>
              <dt>Fecha de expedición</dt><dd>{result.data.fecha_expedicion.split('-').reverse().join('/')}</dd></dl>
          </section>}
        </div>
      </div>
    </section>
  </main>
}
