import {useState} from 'react'
import {useIntl} from 'react-intl'
import {IntakeModal} from './IntakeUI'
import {privacyLabels} from './enrollmentPrivacyText'

export function EnrollmentPrivacy({notice, policy}: {notice?: string; policy?: string}) {
  const {locale} = useIntl()
  const labels = privacyLabels(locale)
  const [open, setOpen] = useState(false)
  return <>
    <p style={{whiteSpace: 'pre-wrap'}}>{notice}</p>
    {policy && <p><button type='button' className='btn btn-light-primary btn-sm' onClick={() => setOpen(true)}>
      <i className='ki-solid ki-shield-tick fs-4' aria-hidden='true' />{labels.consult}
    </button></p>}
    {open && <IntakeModal title={labels.title} close={() => setOpen(false)}>
      <div style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>{policy}</div>
    </IntakeModal>}
  </>
}
