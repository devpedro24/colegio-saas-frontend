import {useState, type InputHTMLAttributes} from 'react'
import {useIntl} from 'react-intl'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {wrapperClassName?: string}

export function PasswordField({wrapperClassName = '', className = 'form-control', ...props}: Props) {
  const [visible, setVisible] = useState(false)
  const intl = useIntl()

  return <div className={`position-relative ${wrapperClassName}`}>
    <input {...props} type={visible ? 'text' : 'password'} className={className} style={{...props.style, paddingRight: '3rem'}} />
    <button
      type='button'
      className='btn btn-sm btn-icon position-absolute top-50 end-0 translate-middle-y me-2'
      aria-label={intl.formatMessage({id: visible ? 'password.hide' : 'password.show'})}
      aria-pressed={visible}
      onClick={() => setVisible(value => !value)}
    >
      <i className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'} fs-4`} aria-hidden='true' />
    </button>
  </div>
}
