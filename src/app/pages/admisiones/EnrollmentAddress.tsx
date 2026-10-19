import {useIntl} from 'react-intl'
import type {StudentData} from './ingreso.types'

export type Department = {codigo: string; nombre: string; municipios: {codigo: string; nombre: string}[]}
export function EnrollmentAddress({data, departments, disabled, onChange}: {data: StudentData; departments: Department[]; disabled: boolean; onChange: (data: StudentData) => void}) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const domestic = (data.pais ?? 'CO') === 'CO'
  const municipalities = departments.find(d => d.codigo === data.departamento)?.municipios ?? []
  return <>
    <div><label className='required' htmlFor='address-country'>{t('intake.validation.country')}</label><select id='address-country' className='form-select' disabled={disabled} value={domestic ? 'CO' : 'other'} onChange={e => onChange({...data, pais: e.target.value === 'CO' ? 'CO' : '', departamento: '', municipio: ''})}><option value='CO'>Colombia</option><option value='other'>{t('intake.validation.foreignAddress')}</option></select></div>
    {!domestic && <div><label className='required' htmlFor='address-country-name'>{t('intake.validation.countryName')}</label><input id='address-country-name' required pattern='.*\S.*' maxLength={80} className='form-control' disabled={disabled} value={data.pais ?? ''} onChange={e => onChange({...data, pais: e.target.value})} /></div>}
    <div><label className='required' htmlFor='address-department'>{t('intake.validation.department')}</label>{domestic ? <select id='address-department' required className='form-select' disabled={disabled || !departments.length} value={data.departamento ?? ''} onChange={e => onChange({...data, departamento: e.target.value, municipio: ''})}><option value=''>{t('intake.validation.selectDepartment')}</option>{departments.map(d => <option key={d.codigo} value={d.codigo}>{d.nombre}</option>)}</select> : <input id='address-department' className='form-control' required pattern='.*\S.*' maxLength={100} disabled={disabled} value={data.departamento ?? ''} onChange={e => onChange({...data, departamento: e.target.value})} />}</div>
    <div><label className='required' htmlFor='address-municipality'>{t('intake.validation.municipality')}</label>{domestic ? <select id='address-municipality' required className='form-select' disabled={disabled || !data.departamento} value={data.municipio ?? ''} onChange={e => onChange({...data, municipio: e.target.value})}><option value=''>{t('intake.validation.selectMunicipality')}</option>{municipalities.map(m => <option key={m.codigo} value={m.codigo}>{m.nombre}</option>)}</select> : <input id='address-municipality' required pattern='.*\S.*' maxLength={100} className='form-control' disabled={disabled} value={data.municipio ?? ''} onChange={e => onChange({...data, municipio: e.target.value})} />}</div>
    <div className='ingreso-grid-wide'><label className='required' htmlFor='data-address'>{intl.formatMessage({id: 'intake.ui.streetAddress'})}</label><input id='data-address' className='form-control' required pattern='.*\S.*' disabled={disabled} maxLength={200} value={data.direccion ?? ''} onChange={e => onChange({...data, direccion: e.target.value})} /></div>
  </>
}
