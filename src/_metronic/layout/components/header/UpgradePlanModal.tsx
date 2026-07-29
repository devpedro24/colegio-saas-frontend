import {withBase} from '../../../helpers'
import {UPGRADE_MODAL_HTML} from './_UpgradeModalContent'

// Modal #kt_modal_upgrade_plan portado literal de demo46. Se abre desde el boton
// "Upgrade Plan" de la navbar (data-bs-toggle="modal"); el wiring de Bootstrap Modal
// esta en HeaderWrapper (delegacion de clicks data-bs-toggle / data-bs-dismiss).
const UpgradePlanModal = () => {
  return <div dangerouslySetInnerHTML={{__html: withBase(UPGRADE_MODAL_HTML)}} />
}

export {UpgradePlanModal}
