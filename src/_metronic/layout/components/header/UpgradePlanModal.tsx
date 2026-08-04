import {useIntl} from 'react-intl'
import {withBase} from '../../../helpers'
import {getUpgradeModalHtml} from './_UpgradeModalContent'

// Modal #kt_modal_upgrade_plan portado literal de demo46. Se abre desde el boton
// "Upgrade Plan" de la navbar (data-bs-toggle="modal"); el wiring de Bootstrap Modal
// esta en HeaderWrapper (delegacion de clicks data-bs-toggle / data-bs-dismiss).
// i18n: el HTML se genera con intl (labels traducidos) antes de inyectarse.
const UpgradePlanModal = () => {
  const intl = useIntl()
  return <div dangerouslySetInnerHTML={{__html: withBase(getUpgradeModalHtml(intl))}} />
}

export {UpgradePlanModal}
