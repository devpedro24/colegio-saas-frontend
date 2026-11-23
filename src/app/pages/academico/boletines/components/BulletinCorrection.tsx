import {useIntl} from 'react-intl'
import {bulletinPdfUrl, type BulletinIssue} from '../emisiones.api'

export function BulletinCorrection({issue}: {issue: BulletinIssue}) {
  const intl = useIntl()
  const correction = issue.rectificacion
  if (!correction) return null
  const origin = intl.formatMessage({id: 'boletines.issue.correctsRevision'}, {revision: correction.revision_anterior})
  const display = (grade: string, source?: 'colegio' | 'certificado') => {
    const value = /^-?\d+(\.\d{1,4})?$/.test(grade)
      ? intl.formatNumber(Number(grade), {minimumFractionDigits: grade.split('.')[1]?.length ?? 0, maximumFractionDigits: 4}) : grade
    if (!source) return value
    const label = intl.formatMessage({id: source === 'colegio' ? 'boletines.issue.schoolSource' : 'boletines.issue.certificateSource'})
    return value + ' (' + label + ')'
  }
  return <div className='mt-2'>
    <strong className='d-block fs-7'>{intl.formatMessage({id: 'boletines.issue.corrected'})}</strong>
    {correction.boletin_anterior_token
      ? <a href={bulletinPdfUrl(correction.boletin_anterior_token)} target='_blank' rel='noreferrer'>{origin} (PDF)</a> : <span>{origin}</span>}
    {correction.cambios.map(change => <div key={change.materia + '/' + change.periodo} className='fs-7'>
      {change.materia} · {change.periodo} · {display(change.anterior, change.fuente_anterior)} → {display(change.vigente, change.fuente_vigente)}
      {change.anual_anterior != null && change.anual_vigente != null && <div>
        {intl.formatMessage({id: 'boletines.issue.annualResult'}, {subject: change.materia})} · {display(change.anual_anterior)} → {display(change.anual_vigente)}
      </div>}
    </div>)}
  </div>
}
