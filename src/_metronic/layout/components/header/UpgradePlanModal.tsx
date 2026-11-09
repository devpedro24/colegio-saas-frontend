import {lazy, Suspense, useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
const UpgradePlanContent = lazy(() => import('./UpgradePlanContent'))

export function UpgradePlanModal() {
  const intl = useIntl(), modal = useRef<HTMLDivElement>(null)
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    const element = modal.current
    const show = () => setOpened(true)
    element?.addEventListener('show.bs.modal', show)
    return () => element?.removeEventListener('show.bs.modal', show)
  }, [])
  return <div ref={modal} className='modal fade' id='kt_modal_upgrade_plan' tabIndex={-1} aria-hidden='true'>
    <div className='modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable upgrade-plan-dialog'>
      {opened && <Suspense fallback={<div className='modal-content rounded p-10 text-center' role='status'>{intl.formatMessage({id:'common.pleaseWait'})}</div>}><UpgradePlanContent /></Suspense>}
    </div>
  </div>
}
