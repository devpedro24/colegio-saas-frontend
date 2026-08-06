import {FC, useEffect, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useSedes} from '../../academico/estructura/estructura.api'
import {useCreateUsuario, useUpdateUsuario} from '../usuarios.api'
import type {Usuario, UsuarioCreateInput, UsuarioUpdateInput} from '../usuarios.types'
import {ROLE_KEYS, STATUS_KEYS} from '../usuarios.types'

const modalsRoot = document.getElementById('root-modals') || document.body

const STATUS_I18N: Record<string, string> = {active: 'activo', inactive: 'inactivo', suspended: 'suspendido'}

type Props = {
  show: boolean
  usuario: Usuario | null
  onClose: () => void
  onCreated: (email: string, password: string) => void
}

const UsuarioFormDialog: FC<Props> = ({show, usuario, onClose, onCreated}) => {
  const intl = useIntl()
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({id}, values)
  const toast = useToast()
  const create = useCreateUsuario()
  const update = useUpdateUsuario()
  const {data: sedes} = useSedes(show)
  const isEdit = usuario !== null
  const pending = create.isPending || update.isPending

  const sedesExtra = (sedes?.data ?? []).filter((s) => s.tenant_id !== null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('docente')
  const [sedeId, setSedeId] = useState('')
  const [status, setStatus] = useState('active')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    setName(usuario?.name ?? '')
    setEmail(usuario?.email ?? '')
    setRole(usuario?.role ?? 'docente')
    setSedeId(usuario?.sede_id ?? '')
    setStatus(usuario?.status ?? 'active')
    setPassword('')
    setError(null)
  }, [usuario])

  const fe = (field: string): string | undefined => error?.fieldError(field)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (isEdit && usuario) {
      update.mutate(
        {
          id: usuario.id,
          input: {
            name: name.trim(),
            role,
            sede_id: usuario.sede_id ?? null,
            status,
            ...(password.trim() ? {password: password.trim()} : {}),
          },
        },
        {
          onSuccess: () => { toast.success(t('common.toast.updated')); onClose() },
          onError,
        }
      )
    } else {
      create.mutate(
        {
          name: name.trim(),
          email: email.trim(),
          role,
          sede_id: sedeId ? Number(sedeId) : null,
          ...(password.trim() ? {password: password.trim()} : null),
        },
        {
          onSuccess: (res) => {
            toast.success(t('common.toast.created'))
            onClose()
            onCreated(res.data.email, res.password ?? '')
          },
          onError,
        }
      )
    }
  }

  return createPortal(
    <Modal
      tabIndex={-1}
      aria-hidden='true'
      dialogClassName='modal-dialog modal-dialog-centered mw-600px'
      show={show}
      onHide={onClose}
      backdrop={true}
    >
      <div className='modal-header'>
        <h2 className='fw-bold'>
          {isEdit ? t('academico.usuarios.formTitleEdit') : t('academico.usuarios.new')}
        </h2>
        <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={onClose}>
          <i className='ki-duotone ki-cross fs-1'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <div className='modal-body py-lg-10 px-lg-10'>
          {/* Nombre */}
          <div className='fv-row mb-7'>
            <label className='required fs-6 fw-semibold mb-2'>{t('common.name')}</label>
            <input
              type='text'
              className={`form-control form-control-solid ${fe('name') ? 'is-invalid' : ''}`}
              value={name}
              placeholder={t('academico.usuarios.field.nombrePh')}
              onChange={(e) => setName(e.target.value)}
            />
            {fe('name') && <div className='invalid-feedback'>{fe('name')}</div>}
          </div>

          {/* Email (solo crear) */}
          {!isEdit && (
            <div className='fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>{t('common.email')}</label>
              <input
                type='email'
                className={`form-control form-control-solid ${fe('email') ? 'is-invalid' : ''}`}
                value={email}
                placeholder={t('academico.usuarios.field.emailPh')}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fe('email') && <div className='invalid-feedback'>{fe('email')}</div>}
            </div>
          )}

          {/* Rol + Sede */}
          <div className='row'>
            <div className='col-md-6 fv-row mb-7'>
              <label className='required fs-6 fw-semibold mb-2'>{t('common.field.rol')}</label>
              <select
                className={`form-select form-select-solid ${fe('role') ? 'is-invalid' : ''}`}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {intl.formatMessage({id: `academico.usuarios.rol.${r}`, defaultMessage: r})}
                  </option>
                ))}
              </select>
              {fe('role') && <div className='invalid-feedback'>{fe('role')}</div>}
            </div>
            {!isEdit ? (
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>{t('common.field.sede')}</label>
                <select
                  className={`form-select form-select-solid ${fe('sede_id') ? 'is-invalid' : ''}`}
                  value={sedeId}
                  onChange={(e) => setSedeId(e.target.value)}
                >
                  <option value=''>{t('academico.usuarios.sede.colegio')}</option>
                  {sedesExtra.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                {fe('sede_id') && <div className='invalid-feedback'>{fe('sede_id')}</div>}
              </div>
            ) : (
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>{t('common.field.sede')}</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={usuario?.sede_nombre ?? t('academico.usuarios.sede.colegio')}
                  readOnly
                />
              </div>
            )}
          </div>

          {/* Password + Estado (editar) / Password (crear) */}
          {!isEdit ? (
            <div className='fv-row'>
              <label className='fs-6 fw-semibold mb-2'>{t('common.password.temporal')}</label>
              <input
                type='text'
                className={`form-control form-control-solid ${fe('password') ? 'is-invalid' : ''}`}
                value={password}
                placeholder={t('academico.usuarios.field.passwordPh')}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fe('password') && <div className='invalid-feedback'>{fe('password')}</div>}
            </div>
          ) : (
            <div className='row'>
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>{t('common.password.temporal')}</label>
                <input
                  type='text'
                  className='form-control form-control-solid'
                  value={password}
                  placeholder={t('academico.usuarios.field.passwordPh')}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className='col-md-6 fv-row mb-7'>
                <label className='fs-6 fw-semibold mb-2'>{t('common.status')}</label>
                <select
                  className='form-select form-select-solid'
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_KEYS.map((s) => (
                    <option key={s} value={s}>
                      {t(`common.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        <div className='modal-footer'>
          <button type='button' className='btn btn-light' onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type='submit' className='btn btn-primary' disabled={pending}>
            {pending ? (
              <span className='spinner-border spinner-border-sm align-middle'></span>
            ) : (
              t('common.save', {name: intl.formatMessage({id: 'entity.usuario'})})
            )}
          </button>
        </div>
      </form>
    </Modal>,
    modalsRoot
  )
}

export {UsuarioFormDialog}
