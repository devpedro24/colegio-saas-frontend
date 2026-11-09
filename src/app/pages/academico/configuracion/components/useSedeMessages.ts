import {useMemo} from 'react'
import {createIntl, createIntlCache, useIntl} from 'react-intl'
import es from './sede.es.json'
import en from './sede.en.json'

const cache = createIntlCache()

export function useSedeMessages() {
  const intl = useIntl()
  const local = useMemo(() => createIntl({locale: intl.locale,
    messages: intl.locale.startsWith('es') ? es : en}, cache), [intl.locale])
  return (id: string, values?: Record<string, string | number>) =>
    (id.startsWith('sede.') ? local : intl).formatMessage({id}, values)
}
