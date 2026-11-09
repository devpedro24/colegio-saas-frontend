import {useEffect, useMemo, useRef, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {api} from '@/lib/api/client'
import './contact-mobile.css'

type Country = {
  country: string
  calling_code: string
  lengths: number[]
  pattern: string
  leading_digits: string | null
  example: string
  timezones: string[]
}

const flags = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true, query: '?url', import: 'default'
})

function validNational(number: string, country: Country) {
  return country.lengths.includes(number.length) &&
    new RegExp(`^(?:${country.pattern})$`).test(number) &&
    (!country.leading_digits || new RegExp(`^(?:${country.leading_digits})`).test(number))
}

function deviceCountry(countries: Country[]) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const byTimezone = countries.find((country) => country.timezones.includes(timezone))
  const region = navigator.language.split('-')[1]?.toUpperCase()
  return byTimezone?.country ?? countries.find((country) => country.country === region)?.country ?? 'CO'
}

export function ContactMobileInput({id, value, onChange, onValidityChange, fixedCountry, disabled = false}: {
  id: string
  value: string
  onChange: (value: string, country: string) => void
  onValidityChange: (valid: boolean) => void
  fixedCountry?: string
  disabled?: boolean
}) {
  const {locale} = useIntl()
  const spanish = locale.startsWith('es')
  const query = useQuery({
    queryKey: ['contact-options'],
    queryFn: () => api.get<{countries: Country[]}>('/contact-options'),
    staleTime: Infinity
  })
  const countries = query.data?.countries
  const names = useMemo(() => new Intl.DisplayNames([locale], {type: 'region'}), [locale])
  const sorted = useMemo(() => [...(countries ?? [])].sort((a, b) =>
    (names.of(a.country) ?? a.country).localeCompare(names.of(b.country) ?? b.country, locale)
  ), [countries, names, locale])
  const [chosen, setChosen] = useState<string>()
  const [touched, setTouched] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const preferred = fixedCountry ?? chosen ?? (countries ? deviceCountry(countries) : 'CO')
  const clean = value.replace(/[\s().-]/g, '')
  const matches = countries?.filter((item) => clean.startsWith(`+${item.calling_code}`)) ?? []
  const inferred = matches.find((item) => item.country === preferred && validNational(clean.slice(item.calling_code.length + 1), item)) ??
    matches.find((item) => validNational(clean.slice(item.calling_code.length + 1), item)) ??
    matches.find((item) => item.country === preferred) ?? matches[0]
  const country = countries?.find((item) => item.country === (fixedCountry ?? chosen ?? inferred?.country ?? preferred))
  const flagCode = country?.country === 'AC' ? 'sh-ac' : country?.country.toLowerCase()
  const number = country && clean.startsWith(`+${country.calling_code}`) ? clean.slice(country.calling_code.length + 1) : clean
  const valid = !!country && (!number || validNational(number, country))
  const message = country
    ? spanish
      ? `Ingresa un celular válido para +${country.calling_code} de ${country.lengths.join(' o ')} dígitos.`
      : `Enter a valid mobile number for +${country.calling_code} with ${country.lengths.join(' or ')} digits.`
    : spanish ? 'Espera a que carguen los indicativos.' : 'Wait for the country codes to load.'

  useEffect(() => {
    input.current?.setCustomValidity(valid ? '' : message)
    onValidityChange(valid)
  }, [valid, message, onValidityChange])

  const updateNumber = (next: string) => {
    if (!country) return
    const normalized = next.replace(/[\s().-]/g, '')
    if (normalized.startsWith('+') && !fixedCountry) setChosen(undefined)
    setTouched(true)
    onChange(normalized ? (normalized.startsWith('+') ? normalized : `+${country.calling_code}${normalized}`) : '', country.country)
  }

  return <div className='contact-mobile'>
    <div className={`contact-mobile__fields ${touched && !valid ? 'contact-mobile__fields--invalid' : ''}`}>
      <div className='contact-mobile__country'>
        {country && <img alt='' width='22' height='16' src={flags[`/node_modules/flag-icons/flags/4x3/${flagCode}.svg`]} />}
        <span aria-hidden='true'>{country ? `+${country.calling_code}` : '…'}</span>
        <select
          id={`${id}-country`}
          aria-label={spanish ? 'País e indicativo del celular' : 'Mobile country and calling code'}
          title={country ? names.of(country.country) : ''}
          value={country?.country ?? ''}
          disabled={disabled || !country || !!fixedCountry}
          onChange={(event) => {
            const next = countries?.find((item) => item.country === event.target.value)
            if (!next) return
            setChosen(next.country)
            setTouched(true)
            onChange(number ? `+${next.calling_code}${number}` : '', next.country)
          }}
        >
          {!country && <option value=''>{spanish ? 'Cargando…' : 'Loading…'}</option>}
          {sorted.map((item) => <option key={item.country} value={item.country}>
            {names.of(item.country)} (+{item.calling_code})
          </option>)}
        </select>
        {!fixedCountry && <span className='contact-mobile__chevron' aria-hidden='true'>⌄</span>}
      </div>
      <input
        ref={input}
        id={id}
        type='tel'
        inputMode='numeric'
        autoComplete='tel-national'
        className='form-control form-control-solid'
        value={number}
        disabled={disabled}
        readOnly={!country}
        maxLength={country ? Math.max(...country.lengths) : 15}
        placeholder={country ? `${spanish ? 'Ej.' : 'e.g.'} ${country.example}` : ''}
        aria-invalid={touched && !valid}
        aria-describedby={`${id}-help`}
        onBlur={() => setTouched(true)}
        onPaste={(event) => {
          if (!country) return
          event.preventDefault()
          const pasted = event.clipboardData.getData('text').replace(/[\s().-]/g, '')
          const start = event.currentTarget.selectionStart ?? 0
          const end = event.currentTarget.selectionEnd ?? number.length
          const next = number.slice(0, start) + pasted + number.slice(end)
          updateNumber(next)
        }}
        onChange={(event) => updateNumber(event.target.value)}
      />
    </div>
    <div id={`${id}-help`} className={`form-text ${touched && !valid ? 'text-danger' : ''}`}>
      {query.isError ? <button type='button' className='btn btn-sm btn-light-danger' onClick={() => query.refetch()}>
        {spanish ? 'Reintentar carga de indicativos' : 'Retry loading country codes'}
      </button> : touched && !valid ? message : country &&
        `${names.of(country.country)} · ${country.lengths.join(' / ')} ${spanish ? 'dígitos, sin el indicativo' : 'digits, without calling code'}`}
    </div>
  </div>
}
