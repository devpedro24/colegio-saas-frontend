import {useMemo} from 'react'
import {createIntl, useIntl} from 'react-intl'
import es from './commercial.es.json'
import en from './commercial.en.json'

/** Feature dictionaries stay in the lazy commercial chunk. */
export function useCommercialText() {
  const intl = useIntl()
  const commercial = useMemo(() => createIntl({locale: intl.locale,
    messages: intl.locale.startsWith('en') ? en : es}), [intl.locale])
  return (id: string, values?: Record<string, string | number>) =>
    (id.startsWith('commercial.') ? commercial : intl).formatMessage({id}, values)
}
