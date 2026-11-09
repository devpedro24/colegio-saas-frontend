import {useEffect, useRef, useState, type InputHTMLAttributes} from 'react'

/** Keep the editing text even when a numeric parent converts an empty value to 0. */
export function NumberInput({value, onChange, onBlur, ...props}: InputHTMLAttributes<HTMLInputElement>) {
  const [text, setText] = useState(String(value ?? ''))
  const draft = useRef(text)
  useEffect(() => {
    const incoming = String(value ?? '')
    if (incoming === draft.current || (incoming !== '' && Number(incoming) === Number(draft.current))) return
    draft.current = incoming
    setText(incoming)
  }, [value])
  return <input {...props} type='number' value={text}
    onChange={event => {
      const next = event.target.value.replace(/^(-?)0+(?=\d)/, '$1')
      event.target.value = next
      draft.current = next
      setText(next)
      onChange?.(event)
    }}
    onBlur={event => {
      onBlur?.(event)
    }} />
}
