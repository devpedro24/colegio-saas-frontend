import {FormEvent, useState} from 'react'
import {useAuth} from '@/app/modules/auth'
import {getCurrentUser} from '@/app/modules/auth/core/_requests'
import {ApiError, api} from '@/lib/api/client'
import {onboardingKey, type Institution, type OnboardingStatus} from './onboarding.api'
import {useQueryClient} from '@tanstack/react-query'
import {useIntl} from 'react-intl'
import {PasswordField} from '@/app/shared/components/PasswordField'
import {PasswordRequirements} from '@/app/shared/components/PasswordRequirements'
import {passwordMeetsPolicy} from '@/app/shared/passwordPolicy'
import {LogoUploader} from './LogoUploader'
import './OnboardingPage.css'

type Props = {status: OnboardingStatus; refresh: () => Promise<unknown>}

const blank: Institution = {nombre: '', nit: '', resolucion_men: '', direccion: '', telefono: '', correo: ''}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError
    ? Object.values(error.errors ?? {}).flat()[0] ?? error.message
    : fallback
}

export function OnboardingPage({status, refresh}: Props) {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id})
  const {currentUser, setCurrentUser, logout} = useAuth()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<'logo' | 'datos'>(status.logo_url ? 'datos' : 'logo')
  const [password, setPassword] = useState({current_password: '', new_password: '', new_password_confirmation: ''})
  const [institution, setInstitution] = useState<Institution>({...blank, ...status.institution})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    await queryClient.invalidateQueries({queryKey: onboardingKey(currentUser?.tenant_channel)})
    await refresh()
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!passwordMeetsPolicy(password.new_password)) { setError(t('password.invalid')); return }
    if (password.new_password !== password.new_password_confirmation) { setError(t('password.mismatch')); return }
    setBusy(true)
    try {
      await api.post('/account/password', password)
      setCurrentUser((await getCurrentUser()).data)
      setPassword({current_password: '', new_password: '', new_password_confirmation: ''})
      await reload()
    } catch (err) { setError(message(err, t('onboarding.saveError'))) }
    finally { setBusy(false) }
  }

  const saveInstitution = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.put('/onboarding/institution', institution)
      await reload()
    } catch (err) { setError(message(err, t('onboarding.saveError'))) }
    finally { setBusy(false) }
  }

  const activeStep = status.password_required ? 1 : step === 'logo' ? 2 : 3

  const stepLabels = [t('onboarding.password'), t('onboarding.logo'), t('onboarding.institution')]

  return (
    <main className='onboarding-page'>
      <div className='onboarding-shell'>
        <aside className='onboarding-intro'>
          <div className='onboarding-topbar'>
            <span className='onboarding-badge'>
              <i className='bi bi-stars' aria-hidden='true' />
              {t('onboarding.first')}
            </span>
            <button type='button' className='onboarding-logout' onClick={() => void logout().catch(() => setError(t('common.toast.genericError')))}>
              <i className='bi bi-box-arrow-right' aria-hidden='true' />
              {t('onboarding.logout')}
            </button>
          </div>

          <div className='onboarding-headline'>
            <div className='onboarding-mark' aria-hidden='true'>
              <i className='bi bi-building-check' />
            </div>
            <h1>{t('onboarding.title')}</h1>
            <p>{t('onboarding.subtitle')}</p>
          </div>

          <ol className='onboarding-steps' aria-label={t('onboarding.title')}>
            {stepLabels.map((label, index) => {
              const number = index + 1
              return (
                <li
                  key={label}
                  className={'onboarding-step' + (activeStep === number ? ' is-active' : activeStep > number ? ' is-done' : '')}
                  aria-current={activeStep === number ? 'step' : undefined}
                >
                  <span className='onboarding-step-number'>
                    {activeStep > number ? <i className='bi bi-check-lg' aria-hidden='true' /> : number}
                  </span>
                  <span className='onboarding-step-label'>{label}</span>
                </li>
              )
            })}
          </ol>
        </aside>

        <section className='onboarding-content'>
          <div className='onboarding-content-top'>
            <span>{intl.formatMessage({id: 'onboarding.progress'}, {current: activeStep})}</span>
            <div
              className='onboarding-progress-track'
              role='progressbar'
              aria-valuenow={activeStep}
              aria-valuemin={1}
              aria-valuemax={3}
              aria-label={t('onboarding.title')}
            >
              <span style={{width: String(activeStep / 3 * 100) + '%'}} />
            </div>
          </div>

          {error && <div className='alert alert-danger' role='alert'>{error}</div>}

          {status.password_required ? (
            <form className='onboarding-form' onSubmit={changePassword}>
              <h2>{t('onboarding.passwordTitle')}</h2>
              <p className='onboarding-form-help'>{t('onboarding.passwordHelp')}</p>
              <div className='row g-5'>
                {([
                  ['current_password', t('onboarding.currentPassword')],
                  ['new_password', t('onboarding.newPassword')],
                  ['new_password_confirmation', t('onboarding.confirmPassword')],
                ] as const).map(([field, label]) => (
                  <div className='col-12' key={field}>
                    <label htmlFor={'onboarding-' + field} className='form-label required'>{label}</label>
                    <PasswordField
                      id={'onboarding-' + field}
                      autoComplete={field === 'current_password' ? 'current-password' : 'new-password'}
                      className='form-control form-control-solid'
                      value={password[field]}
                      onChange={e => setPassword({...password, [field]: e.target.value})}
                      required
                    />
                  </div>
                ))}
              </div>
              <PasswordRequirements password={password.new_password} />
              <div className='onboarding-actions'>
                <button type='submit' className='btn btn-success' disabled={busy}>
                  {busy ? t('onboarding.saving') : t('onboarding.passwordContinue')}
                  {!busy && <i className='bi bi-arrow-right ms-3' aria-hidden='true' />}
                </button>
              </div>
            </form>
          ) : step === 'logo' ? (
            <div className='onboarding-form'>
              <h2>{t('onboarding.logo')}</h2>
              <p className='onboarding-form-help'>{t('onboarding.logoHelp')}</p>
              <LogoUploader
                existingUrl={status.logo_url}
                saveLabel={t('onboarding.logoContinue')}
                onSaved={async () => { await reload(); setStep('datos') }}
                onContinue={() => setStep('datos')}
              />
            </div>
          ) : (
            <form className='onboarding-form' onSubmit={saveInstitution}>
              <h2>{t('onboarding.institution')}</h2>
              <p className='onboarding-form-help'>{t('onboarding.institutionHelp')}</p>
              <div className='row g-5'>
                {([
                  ['nombre', t('onboarding.field.name'), 'text'],
                  ['nit', t('onboarding.field.nit'), 'text'],
                  ['resolucion_men', t('onboarding.field.resolution'), 'text'],
                  ['direccion', t('onboarding.field.address'), 'text'],
                  ['telefono', t('onboarding.field.phone'), 'tel'],
                  ['correo', t('onboarding.field.email'), 'email'],
                ] as const).map(([field, label, type]) => (
                  <div className='col-md-6' key={field}>
                    <label htmlFor={'onboarding-' + field} className='form-label required'>{label}</label>
                    <input
                      id={'onboarding-' + field}
                      type={type}
                      className='form-control form-control-solid'
                      value={institution[field] ?? ''}
                      onChange={e => setInstitution({...institution, [field]: e.target.value})}
                      required
                      maxLength={field === 'nit' || field === 'telefono' ? 60 : 255}
                    />
                  </div>
                ))}
              </div>
              <div className='onboarding-actions onboarding-actions-between'>
                <button type='button' className='btn btn-light' onClick={() => setStep('logo')}>
                  <i className='bi bi-arrow-left me-2' aria-hidden='true' />
                  {t('onboarding.changeLogo')}
                </button>
                <button type='submit' className='btn btn-success' disabled={busy}>
                  {busy ? t('onboarding.saving') : t('onboarding.finish')}
                  {!busy && <i className='bi bi-arrow-right ms-3' aria-hidden='true' />}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
