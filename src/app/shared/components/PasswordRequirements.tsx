import {useIntl} from 'react-intl'
import {passwordChecks} from '../passwordPolicy'

export function PasswordRequirements({password}: {password: string}) {
  const intl = useIntl()
  const checks = passwordChecks(password)
  return <div className='mt-3 mb-4' aria-live='polite'>
    <p className='fw-semibold mb-2'>{intl.formatMessage({id: 'password.requirements'})}</p>
    <ul className='list-unstyled mb-0 fs-7'>
      {(Object.entries(checks) as Array<[keyof typeof checks, boolean]>).map(([name, valid]) =>
        <li key={name} className={valid ? 'text-success' : 'text-muted'}>
          <i className={`bi ${valid ? 'bi-check-circle-fill' : 'bi-circle'} me-2`} aria-hidden='true' />
          {intl.formatMessage({id: `password.rule.${name}`})}
        </li>
      )}
    </ul>
  </div>
}
