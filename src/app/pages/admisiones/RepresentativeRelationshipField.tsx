import {useIntl} from 'react-intl'
import {cleanName, namePattern, relationshipChoice} from '@/lib/validation/personInput'

type Props = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}

export function RepresentativeRelationshipField({id, label, value, onChange, required, disabled}: Props) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const choice = relationshipChoice(value)
  const other = value.trim().toLowerCase() === 'otro' ? '' : value
  return <div className='intake-field'>
    <label htmlFor={id} className={required ? 'required' : ''}>{label}</label>
    <select id={id} className='form-select' value={choice} required={required} disabled={disabled}
      onChange={event => onChange(event.target.value)}>
      <option value=''>{t('intake.ui.select')}</option>
      <option value='Madre'>{t('intake.ui.mother')}</option>
      <option value='Padre'>{t('intake.ui.father')}</option>
      <option value='Otro'>{t('intake.ui.other')}</option>
    </select>
    {choice === 'Otro' && <div className='mt-3'>
      <label htmlFor={`${id}-other`} className='required'>{t('intake.ui.specifyRelationship')}</label>
      <input id={`${id}-other`} className='form-control' type='text' required disabled={disabled}
        placeholder={t('intake.ui.specifyRelationship')} pattern={namePattern} maxLength={100}
        value={other} onChange={event => onChange(cleanName(event.target.value) || 'Otro')} />
    </div>}
  </div>
}
