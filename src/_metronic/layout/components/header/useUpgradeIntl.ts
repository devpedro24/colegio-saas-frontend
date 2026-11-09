import {useMemo} from 'react'
import {createIntl, createIntlCache, useIntl} from 'react-intl'
import es from './upgrade.es.json'
import en from './upgrade.en.json'

const cache = createIntlCache()
/** Pricing copy is loaded only when the upgrade modal is opened. */
export function useUpgradeIntl() {
  const parent = useIntl()
  return useMemo(() => createIntl({locale: parent.locale,
    messages: {...parent.messages, ...(parent.locale.startsWith('en') ? en : es)}}, cache), [parent.locale, parent.messages])
}
