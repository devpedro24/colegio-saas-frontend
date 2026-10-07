import {useEffect, useState, type FormEvent} from 'react'
import Modal from 'react-bootstrap/Modal'
import {useToast} from '@/lib/ui/toast'
import {useAulaConfiguration, useGuardarAulaConfiguration} from './aula.api'

export function AulaConfigurationDialog({show, onHide}: {show: boolean; onHide: () => void}) {
  const {data, isLoading, error} = useAulaConfiguration(show)
  const save = useGuardarAulaConfiguration()
  const toast = useToast()
  const [allowClosed, setAllowClosed] = useState(true)
  const [periodColors, setPeriodColors] = useState<Record<string, string>>({})
  const [preinformeColor, setPreinformeColor] = useState('#64748B')
  useEffect(() => {
    if (!data) return
    setAllowClosed(data.permitir_edicion_periodos_cerrados)
    setPeriodColors(data.colores_periodos)
    setPreinformeColor(data.color_preinforme)
  }, [data])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await save.mutateAsync({permitir_edicion_periodos_cerrados: allowClosed,
        ...(data?.puede_configurar_colores ? {colores_periodos: periodColors, color_preinforme: preinformeColor} : {})})
      toast.success('Configuración del Aula guardada.')
      onHide()
    } catch (cause) {toast.error(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.')}
  }

  return <Modal show={show} onHide={onHide} centered className='aula-configuration-modal' aria-labelledby='aula-configuration-title'>
    <form onSubmit={event => void submit(event)}>
      <Modal.Header closeButton><Modal.Title id='aula-configuration-title'>Configuración del Aula</Modal.Title></Modal.Header>
      <Modal.Body>
        {isLoading && <p role='status'>Cargando configuración…</p>}
        {error && <div className='alert alert-danger' role='alert'>No se pudo cargar la configuración.</div>}
        {data && <><p className='text-muted'>Estos ajustes se aplican a todas las aulas del colegio.</p>
          <label className='form-check form-switch d-flex align-items-start gap-3'>
            <input className='form-check-input aula-visibility-toggle flex-shrink-0' type='checkbox'
              checked={allowClosed} onChange={event => setAllowClosed(event.target.checked)} />
            <span><strong>Permitir preparar contenido en períodos cerrados</strong>
              <small className='d-block text-muted mt-1'>Incluye crear, editar, publicar, archivar y adjuntar recursos.
                Si se desactiva, estas acciones quedan bloqueadas en períodos cerrados.</small></span>
          </label>
          <div className='aula-configuration-note mt-5'>El cierre del período siempre protege la planilla,
            las calificaciones y las entregas, independientemente de esta opción.</div>
          {data.puede_configurar_colores && <section className='aula-configuration-colors' aria-labelledby='aula-colors-title'>
            <h3 id='aula-colors-title'>Colores de la jerarquía</h3>
            <p>Se aplican a los títulos de períodos y preinformes del menú izquierdo y del contenido del Aula.
              Cada color de período se reutiliza en la misma posición de los demás años lectivos.</p>
            <div className='aula-configuration-color-grid'>
              {data.periodos_configurables.map(period => <label className='aula-configuration-color' key={period.orden}>
                <span>{period.nombre}</span>
                <input type='color' aria-label={`Color de ${period.nombre}`} value={periodColors[String(period.orden)] || '#2563EB'}
                  onChange={event => setPeriodColors(current => ({...current, [String(period.orden)]: event.target.value}))} />
              </label>)}
              <label className='aula-configuration-color'><span>Preinformes</span>
                <input type='color' aria-label='Color de los preinformes' value={preinformeColor}
                  onChange={event => setPreinformeColor(event.target.value)} /></label>
            </div>
          </section>}</>}
      </Modal.Body>
      <Modal.Footer><button type='button' className='btn btn-light' onClick={onHide}>Cancelar</button>
        <button type='submit' className='btn btn-success' disabled={!data || save.isPending}>Guardar cambios</button></Modal.Footer>
    </form>
  </Modal>
}
