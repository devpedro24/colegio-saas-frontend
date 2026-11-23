import {useEffect, useMemo, useRef, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {Overlay, Popover} from 'react-bootstrap'
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

const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

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

export function ContactMobileInput({id, value, onChange, onValidityChange, fixedCountry, disabled = false, required = false, optionsPath = '/contact-options'}: {
  id: string
  value: string
  onChange: (value: string, country: string) => void
  onValidityChange?: (valid: boolean) => void
  fixedCountry?: string
  disabled?: boolean
  required?: boolean
  optionsPath?: string
}) {
  const {locale} = useIntl()
  const spanish = locale.startsWith('es')
  const query = useQuery({
    queryKey: optionsPath === '/contact-options' ? ['contact-options'] : ['contact-options', optionsPath],
    queryFn: () => api.get<{countries: Country[]}>(optionsPath),
    staleTime: Infinity
  })
  const countries = query.data?.countries
  const names = useMemo(() => new Intl.DisplayNames([locale], {type: 'region'}), [locale])
  const sorted = useMemo(() => [...(countries ?? [])].sort((a, b) =>
    (names.of(a.country) ?? a.country).localeCompare(names.of(b.country) ?? b.country, locale)
  ), [countries, names, locale])
  const [chosen, setChosen] = useState<string>()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const countryList = useRef<HTMLDivElement>(null)
  const [touched, setTouched] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const preferred = fixedCountry ?? chosen ?? (countries ? deviceCountry(countries) : 'CO')
  const clean = value.replace(/[\s().-]/g, '')
  const matches = countries?.filter((item) => clean.startsWith(`+${item.calling_code}`)) ?? []
  const inferred = matches.find((item) => item.country === preferred && validNational(clean.slice(item.calling_code.length + 1), item)) ??
    matches.find((item) => validNational(clean.slice(item.calling_code.length + 1), item)) ??
    matches.find((item) => item.country === preferred) ?? matches[0]
  const country = countries?.find((item) => item.country === (fixedCountry ?? chosen ?? inferred?.country ?? preferred))
  const number = country && clean.startsWith(`+${country.calling_code}`) ? clean.slice(country.calling_code.length + 1) : clean
  const valid = !!country && (number ? validNational(number, country) : !required)
  const message = spanish ? 'Ingresa un número celular válido.' : 'Enter a valid mobile number.'
  const countryLabel = (item: Country) => names.of(item.country) ?? item.country
  const flag = (item: Country) => flags[`/node_modules/flag-icons/flags/4x3/${item.country === 'AC' ? 'sh-ac' : item.country.toLowerCase()}.svg`]
  const term = normalizeSearch(search.trim())
  const score = (item: Country) => {
    if (!term) return item.country === country?.country ? 1 : 0
    const label = normalizeSearch(countryLabel(item))
    if (label.startsWith(term) || item.country.toLowerCase() === term) return 4
    if (label.split(/\s+/).some(word => word.startsWith(term)) || `+${item.calling_code}`.startsWith(term) || item.calling_code.startsWith(term)) return 3
    return label.includes(term) ? 2 : 0
  }
  const ordered = [...sorted].sort((a, b) => score(b) - score(a))
  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }
  const choose = (next: Country) => {
    setChosen(next.country)
    setTouched(true)
    onChange(number ? `+${next.calling_code}${number.replace(/\D/g, '').slice(0, Math.max(...next.lengths))}` : '', next.country)
    close(true)
  }
  const focusOption = (index: number) => {
    const options = countryList.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    if (!options?.length) return
    const option = options[(index + options.length) % options.length]
    option.focus()
    option.scrollIntoView({block: 'nearest'})
  }
  useEffect(() => {if (countryList.current) countryList.current.scrollTop = 0}, [open, search])

  useEffect(() => {
    input.current?.setCustomValidity(valid ? '' : message)
    onValidityChange?.(valid)
  }, [valid, message, onValidityChange])

  useEffect(() => {
    if (fixedCountry || !chosen || !inferred || !clean.startsWith('+')) return
    const selected = countries?.find(item => item.country === chosen)
    if (selected && (!clean.startsWith(`+${selected.calling_code}`) ||
      (!validNational(clean.slice(selected.calling_code.length + 1), selected) &&
        validNational(clean.slice(inferred.calling_code.length + 1), inferred)))) setChosen(inferred.country)
  }, [fixedCountry, chosen, inferred, clean, countries])

  const updateNumber = (next: string) => {
    if (!country) return
    const normalized = next.replace(/[\s().-]/g, '')
    const international = normalized.startsWith('+')
    const matches = international ? (countries ?? []).filter(item => normalized.startsWith(`+${item.calling_code}`)) : []
    const target = international && !fixedCountry
      ? matches.find(item => validNational(normalized.slice(item.calling_code.length + 1), item)) ?? matches.find(item => item.country === country.country) ?? matches[0]
      : country
    if (!target || (international && !normalized.startsWith(`+${target.calling_code}`))) return
    const national = (international ? normalized.slice(target.calling_code.length + 1) : normalized).replace(/\D/g, '').slice(0, Math.max(...target.lengths))
    if (!fixedCountry) setChosen(target.country)
    setTouched(true)
    onChange(national ? `+${target.calling_code}${national}` : '', target.country)
  }

  return <div className='contact-mobile'>
    <div className={`contact-mobile__fields ${touched && !valid ? 'contact-mobile__fields--invalid' : ''}`}>
      <div className='contact-mobile__country'>
        {country && <img alt='' width='22' height='16' src={flag(country)} />}
        <span aria-hidden='true'>{country ? `+${country.calling_code}` : '…'}</span>
        <button
          ref={trigger}
          id={`${id}-country`}
          type='button'
          className='contact-mobile__country-toggle'
          data-country={country?.country ?? ''}
          aria-label={spanish ? 'País e indicativo del celular' : 'Mobile country and calling code'}
          aria-haspopup='dialog'
          aria-expanded={open}
          aria-controls={open ? `${id}-country-popover` : undefined}
          title={country ? countryLabel(country) : ''}
          disabled={disabled || !country || !!fixedCountry}
          onClick={() => {setSearch(''); setOpen(!open)}}
          onBlur={event => {if (open && event.relatedTarget && !document.getElementById(`${id}-country-popover`)?.contains(event.relatedTarget as Node)) close()}}
          onKeyDown={event => {if (event.key === 'ArrowDown') {event.preventDefault(); setSearch(''); setOpen(true)}}}
        />
        <Overlay target={trigger.current} show={open && !disabled && !fixedCountry} placement='bottom-start' flip rootClose
          popperConfig={{strategy: 'fixed', modifiers: [
            {name: 'flip', options: {fallbackPlacements: ['top-start'], rootBoundary: 'viewport', padding: 12}},
            {name: 'preventOverflow', options: {rootBoundary: 'viewport', altAxis: true, tether: false, padding: 12}},
          ]}}
          container={trigger.current?.closest<HTMLElement>('.modal') ?? document.body}
          onHide={(event?: Event) => {if (!event || !trigger.current?.contains(event.target as Node)) close()}}
          onEntered={() => {if (countryList.current) countryList.current.scrollTop = 0; searchInput.current?.focus()}}>
          <Popover id={`${id}-country-popover`} className='contact-country-menu' role='dialog'
            aria-label={spanish ? 'Seleccionar país e indicativo' : 'Select country and calling code'}
            onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); close(true)}}}
            onBlur={event => {if (event.relatedTarget && event.relatedTarget !== trigger.current && !event.currentTarget.contains(event.relatedTarget as Node)) close()}}>
            <Popover.Body>
              <div className='contact-country-menu__search'>
                <i className='ki-solid ki-magnifier fs-3' aria-hidden='true' />
                <input ref={searchInput} id={`${id}-country-search`} type='search' className='form-control form-control-solid'
                  role='combobox' aria-expanded={open} aria-controls={`${id}-country-list`} aria-autocomplete='list'
                  autoComplete='off' value={search} placeholder={spanish ? 'Buscar país o indicativo' : 'Search country or calling code'}
                  aria-label={spanish ? 'Buscar país o indicativo' : 'Search country or calling code'}
                  onChange={event => setSearch(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {event.preventDefault(); if (ordered[0] && (!term || score(ordered[0]) > 0)) choose(ordered[0])}
                    if (event.key === 'ArrowDown') {event.preventDefault(); focusOption(0)}
                  }} />
              </div>
              <div ref={countryList} id={`${id}-country-list`} role='listbox' className='contact-country-menu__list'
                aria-label={spanish ? 'Países e indicativos' : 'Countries and calling codes'}>
                {ordered.map((item, index) => <button key={item.country} type='button' role='option'
                  id={`${id}-country-option-${item.country}`} data-country-option={item.country} aria-selected={item.country === country?.country}
                  className='contact-country-menu__option' onClick={() => choose(item)}
                  onKeyDown={event => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
                      event.preventDefault()
                      focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1))
                    }
                  }}>
                  <img src={flag(item)} width='24' height='18' alt='' aria-hidden='true' />
                  <span>{countryLabel(item)}</span><strong>+{item.calling_code}</strong>
                  {item.country === country?.country && <i className='ki-solid ki-check fs-4' aria-hidden='true' />}
                </button>)}
              </div>
            </Popover.Body>
          </Popover>
        </Overlay>
        {!fixedCountry && <span className='contact-mobile__chevron' aria-hidden='true'>⌄</span>}
      </div>
      <input
        ref={input}
        id={id}
        type='tel'
        inputMode='numeric'
        autoComplete='tel-national'
        required={required}
        className='form-control form-control-solid'
        value={number}
        disabled={disabled}
        readOnly={!country}
        maxLength={country ? Math.max(...country.lengths) : 15}
        placeholder={country ? `${spanish ? 'Ej.' : 'e.g.'} ${country.example}` : ''}
        aria-invalid={touched && !valid}
        aria-describedby={query.isError || (touched && !valid) ? `${id}-help` : undefined}
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
    {query.isError ? <div id={`${id}-help`} className='form-text'>
      <button type='button' className='btn btn-sm btn-light-danger' onClick={() => query.refetch()}>
        {spanish ? 'Reintentar carga de indicativos' : 'Retry loading country codes'}
      </button>
    </div> : touched && !valid && <div id={`${id}-help`} className='form-text text-danger' role='alert'>{message}</div>}
  </div>
}
