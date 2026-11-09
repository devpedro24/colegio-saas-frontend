import type {Campaign} from './ingreso.types'
import {IntakeModal} from './IntakeUI'
import {useIntakeText} from './intakeWorkflow'

export function CampaignPreview({name, configuration, close}: {
  name: string
  configuration: Campaign['configuracion']
  close: () => void
}) {
  const t = useIntakeText()
  return <IntakeModal title={t('previewForm')} close={close}>
    <h3>{name}</h3>
    <p className='intake-muted'>{t('previewFormHelp')}</p>
    <div className='intake-grid'>
      {['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'tipo_documento', 'numero_documento', 'nacimiento', 'telefono', 'email', 'direccion', 'madre', 'padre', 'responsable', 'parentesco', 'telefono_responsable'].map(key =>
        <label className='intake-field' key={key}>{t(key)}<input className='form-control' disabled /></label>)}
      {configuration.campos.map(field => <label className='intake-field' key={field.key}>
        {field.nombre}{field.obligatorio && ' *'}
        {field.tipo === 'seleccion'
          ? <select className='form-select' disabled>{field.opciones?.map(option => <option key={option}>{option}</option>)}</select>
          : <input className='form-control' disabled type={field.tipo === 'fecha' ? 'date' : 'text'} />}
      </label>)}
    </div>
    <h3 className='fs-5 mt-7'>{t('documents')}</h3>
    {configuration.documentos.map(document => <div className='intake-document' key={document.key}>
      <strong>{document.nombre}{document.obligatorio && ' *'}</strong>
      <p>{document.instrucciones}</p>
      {document.vigencia && <p>{document.vigencia}</p>}
      <small>{document.formatos.join(', ').toUpperCase()}</small>
    </div>)}
  </IntakeModal>
}
