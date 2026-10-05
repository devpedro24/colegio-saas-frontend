import {FC, useState, type FormEvent} from 'react'
import {createPortal} from 'react-dom'
import {Modal} from 'react-bootstrap'
import {useIntl} from 'react-intl'
import {ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useCreateEscala, useDeleteEscala, useEscalas, useSaveEscalaOpciones, useUpdateEscala, useUploadEscalaImagen} from '../configuracion.api'
import type {
  EscalaValorativa,
  EscalaValorativaInput,
  EscalaOpcionInput,
  NivelEducativo,
  TipoEscala,
} from '../configuracion.types'

const modalsRoot = document.getElementById('root-modals') || document.body
const NIVELES: NivelEducativo[] = ['preescolar', 'primaria', 'secundaria', 'media']

type Props = {anoLectivoToken: string}

interface FormState {
  nombre: string
  nivel_educativo: string // '' = todos
  tipo: TipoEscala
  valor_min: string
  valor_max: string
}

const emptyForm = (): FormState => ({
  nombre: '',
  nivel_educativo: '',
  tipo: 'numerica',
  valor_min: '1',
  valor_max: '5',
})

type ChoiceDraft = EscalaOpcionInput & {imagen_url?: string | null}
const defaultChoices = (): ChoiceDraft[] => [
  {nombre: 'Excelente', valor_equivalente: '5', emoji: '😄', aprueba: true},
  {nombre: 'Bien', valor_equivalente: '4', emoji: '🙂', aprueba: true},
  {nombre: 'En proceso', valor_equivalente: '2.5', emoji: '😐', aprueba: false},
  {nombre: 'Necesita apoyo', valor_equivalente: '1.5', emoji: '😟', aprueba: false},
]

const fromEscala = (e: EscalaValorativa): FormState => ({
  nombre: e.nombre,
  nivel_educativo: e.nivel_educativo ?? '',
  tipo: e.tipo,
  valor_min: e.valor_min === null ? '' : String(e.valor_min),
  valor_max: e.valor_max === null ? '' : String(e.valor_max),
})

// Dialogo interno crear/editar escala (se remonta por escala via key en el padre).
const EscalaForm: FC<{
  anoLectivoToken: string
  escala: EscalaValorativa | null
  onClose: () => void
}> = ({anoLectivoToken, escala, onClose}) => {
  const intl = useIntl()

  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const create = useCreateEscala(anoLectivoToken)
  const update = useUpdateEscala(anoLectivoToken)
  const saveOptions = useSaveEscalaOpciones(anoLectivoToken)
  const uploadImage = useUploadEscalaImagen(anoLectivoToken)
  const isEdit = escala !== null
  const pending = create.isPending || update.isPending || saveOptions.isPending || uploadImage.isPending

  const [form, setForm] = useState<FormState>(escala ? fromEscala(escala) : emptyForm())
  const [choices, setChoices] = useState<ChoiceDraft[]>(escala?.opciones?.length
    ? escala.opciones.map(o => ({url_token: o.url_token, nombre: o.nombre,
        valor_equivalente: String(o.valor_equivalente), emoji: o.emoji,
        aprueba: o.aprueba, imagen_url: o.imagen_url})) : defaultChoices())
  const [error, setError] = useState<ApiError | null>(null)
  const fe = (field: string): string | undefined => error?.fieldError(field)
  const set = (patch: Partial<FormState>) => setForm((prev) => ({...prev, ...patch}))
  const isNumerica = form.tipo === 'numerica'
  const updateChoice = (index: number, patch: Partial<ChoiceDraft>) =>
    setChoices(previous => previous.map((choice, current) => current === index ? {...choice, ...patch} : choice))

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    setError(null)
    const input: EscalaValorativaInput = {
      ano_lectivo_token: anoLectivoToken,
      nombre: form.nombre.trim(),
      nivel_educativo: (form.nivel_educativo || null) as NivelEducativo | null,
      tipo: form.tipo,
      valor_min: isNumerica && form.valor_min !== '' ? Number(form.valor_min) : null,
      valor_max: isNumerica && form.valor_max !== '' ? Number(form.valor_max) : null,
      decimales: isNumerica ? 1 : null,
    }

    const onError = (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err)
        if (!err.errors) toast.error(err.message)
      } else {
        toast.error(t('common.toast.saveError'))
      }
    }

    if (!isNumerica && (choices.length < 2 || choices.length > 8 || choices.some(choice => !choice.nombre.trim() || !choice.valor_equivalente))) {
      toast.error(t('academico.config.escala.opciones.error'))
      return
    }
    try {
      const saved = isEdit && escala
        ? await update.mutateAsync({id: escala.url_token, input})
        : await create.mutateAsync(input)
      if (!isNumerica) {
        await saveOptions.mutateAsync({escalaToken: saved.data.url_token,
          opciones: choices.map(choice => ({url_token: choice.url_token,
            nombre: choice.nombre.trim(), valor_equivalente: choice.valor_equivalente.replace(',', '.'),
            emoji: choice.emoji, aprueba: choice.aprueba}))})
      }
      toast.success(t(isEdit ? 'common.toast.updated' : 'common.toast.created'))
      onClose()
    } catch (error) { onError(error) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className='modal-body py-lg-8 px-lg-8'>
        <div className='fv-row mb-6'>
          <label className='required fs-6 fw-semibold mb-2'>
            {t('academico.config.escala.field.nombre')}
          </label>
          <input
            type='text'
            className={`form-control form-control-solid ${fe('nombre') ? 'is-invalid' : ''}`}
            placeholder={t('academico.config.escala.field.nombrePh')}
            value={form.nombre}
            onChange={(e) => set({nombre: e.target.value})}
          />
          {fe('nombre') && <div className='invalid-feedback'>{fe('nombre')}</div>}
        </div>

        <div className='row'>
          <div className='col-md-6 fv-row mb-6'>
            <label className='fs-6 fw-semibold mb-2'>
              {t('academico.config.escala.field.nivel')}
            </label>
            <select
              className='form-select form-select-solid'
              value={form.nivel_educativo}
              onChange={(e) => set({nivel_educativo: e.target.value})}
            >
              <option value=''>{t('academico.nivel.todos')}</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {t(`academico.nivel.${n}`)}
                </option>
              ))}
            </select>
          </div>
          <div className='col-md-6 fv-row mb-6'>
            <label className='required fs-6 fw-semibold mb-2'>
              {t('academico.config.escala.field.tipo')}
            </label>
            <select
              className='form-select form-select-solid'
              value={form.tipo}
              onChange={(e) => set({tipo: e.target.value as TipoEscala})}
            >
              <option value='numerica'>{t('academico.config.escala.tipo.numerica')}</option>
              <option value='imagenes'>{t('academico.config.escala.tipo.imagenes')}</option>
            </select>
          </div>
        </div>

        {isNumerica && (
          <div className='row'>
            <div className='col-md-4 fv-row mb-2'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.config.escala.field.valorMin')}
              </label>
              <input
                type='number'
                step='0.1'
                className={`form-control form-control-solid ${fe('valor_min') ? 'is-invalid' : ''}`}
                value={form.valor_min}
                onChange={(e) => set({valor_min: e.target.value})}
              />
              {fe('valor_min') && <div className='invalid-feedback'>{fe('valor_min')}</div>}
            </div>
            <div className='col-md-4 fv-row mb-2'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.config.escala.field.valorMax')}
              </label>
              <input
                type='number'
                step='0.1'
                className={`form-control form-control-solid ${fe('valor_max') ? 'is-invalid' : ''}`}
                value={form.valor_max}
                onChange={(e) => set({valor_max: e.target.value})}
              />
              {fe('valor_max') && <div className='invalid-feedback'>{fe('valor_max')}</div>}
            </div>
            <div className='col-md-4 fv-row mb-2'>
              <label className='fs-6 fw-semibold mb-2'>
                {t('academico.config.escala.field.decimales')}
              </label>
              <input
                type='number'
                min={1}
                max={1}
                className={`form-control form-control-solid ${fe('decimales') ? 'is-invalid' : ''}`}
                value={1}
                readOnly
              />
              {fe('decimales') && <div className='invalid-feedback'>{fe('decimales')}</div>}
            </div>
          </div>
        )}
        {!isNumerica && <div className='mt-5'>
          <div className='d-flex justify-content-between align-items-center gap-3 mb-3'>
            <div>
              <h5 className='fw-bold mb-1'>{t('academico.config.escala.opciones.title')}</h5>
              <p className='text-muted fs-7 mb-0'>{t('academico.config.escala.opciones.help')}</p>
            </div>
            <button type='button' className='btn btn-sm btn-light-primary' disabled={choices.length >= 8 || pending}
              onClick={() => setChoices(previous => [...previous, {nombre: '', valor_equivalente: '', emoji: '🙂', aprueba: false}])}>
              {t('academico.config.escala.opciones.add')}
            </button>
          </div>
          {choices.map((choice, index) => <div key={choice.url_token ?? `new-${index}`} className='border rounded-3 p-4 mb-3'>
            <div className='d-flex align-items-center gap-3 mb-3'>
              {choice.imagen_url ? <img src={choice.imagen_url} alt='' width={38} height={38} className='rounded-circle object-fit-cover' />
                : <span aria-hidden='true' style={{fontSize: 28}}>{choice.emoji || '🙂'}</span>}
              <strong className='flex-grow-1'>{index + 1}. {choice.nombre || t('academico.config.escala.opciones.nueva')}</strong>
              <button type='button' className='btn btn-sm btn-light-danger' disabled={choices.length <= 2 || pending}
                onClick={() => setChoices(previous => previous.filter((_, item) => item !== index))}>{t('grading.delete')}</button>
            </div>
            <div className='row g-3'>
              <div className='col-md-5'><label className='form-label required'>{t('academico.config.escala.opciones.nombre')}</label>
                <input className='form-control' maxLength={80} value={choice.nombre} onChange={event => updateChoice(index, {nombre: event.target.value})} /></div>
              <div className='col-md-3'><label className='form-label'>{t('academico.config.escala.opciones.emoji')}</label>
                <input className='form-control' maxLength={16} value={choice.emoji ?? ''} onChange={event => updateChoice(index, {emoji: event.target.value})} /></div>
              <div className='col-md-4'><label className='form-label required'>{t('academico.config.escala.opciones.valor')}</label>
                <input className='form-control' inputMode='decimal' value={choice.valor_equivalente}
                  onChange={event => updateChoice(index, {valor_equivalente: event.target.value})} /></div>
            </div>
            <div className='d-flex flex-wrap align-items-center gap-4 mt-3'>
              <label className='form-check form-check-custom form-check-solid'>
                <input type='checkbox' className='form-check-input' checked={choice.aprueba}
                  onChange={event => updateChoice(index, {aprueba: event.target.checked})} />
                <span className='form-check-label'>{t('academico.config.escala.opciones.aprueba')}</span>
              </label>
              {escala && choice.url_token && <label className='btn btn-sm btn-light-primary mb-0'>
                {t('academico.config.escala.opciones.imagen')}
                <input type='file' accept='image/png,image/jpeg' className='d-none' disabled={pending}
                  onChange={event => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    uploadImage.mutate({escalaToken: escala.url_token, opcionToken: choice.url_token!, file}, {
                      onSuccess: response => {updateChoice(index, {imagen_url: response.data.imagen_url}); toast.success(t('common.toast.updated'))},
                      onError: error => toast.error(error instanceof ApiError ? error.message : t('common.toast.saveError')),
                    })
                    event.target.value = ''
                  }} />
              </label>}
            </div>
          </div>)}
          {!escala && <p className='text-muted fs-7'>{t('academico.config.escala.opciones.uploadLater')}</p>}
        </div>}
      </div>

      <div className='modal-footer'>
        <button type='button' className='btn btn-light' onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type='submit' className='btn btn-primary' disabled={pending}>
          {pending ? (
            <span className='indicator-progress d-block'>
              {t('common.pleaseWait')}
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          ) : (
            intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.escala'})})
          )}
        </button>
      </div>
    </form>
  )
}

// Bloque 4: escala valorativa. Lista + crear/editar/eliminar, filtrada por ano lectivo.
const EscalasCard: FC<Props> = ({anoLectivoToken}) => {
  const intl = useIntl()

  const t = (id: string) => intl.formatMessage({id})
  const toast = useToast()
  const {data, isLoading, isError} = useEscalas(anoLectivoToken)
  const del = useDeleteEscala(anoLectivoToken)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EscalaValorativa | null>(null)

  const escalas = data?.data ?? []

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (e: EscalaValorativa) => {
    setEditing(e)
    setShowForm(true)
  }
  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = (e: EscalaValorativa) => {
    del.mutate(e.url_token, {
      onSuccess: () => toast.success(t('common.toast.deleted')),
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : t('common.toast.deleteError')
        toast.error(message)
      },
    })
  }

  const nivelLabel = (n: NivelEducativo | null) =>
    n ? t(`academico.nivel.${n}`) : t('academico.nivel.todos')

  return (
    <>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4'>
        <div>
          <h4 className='fw-bold mb-1'>{t('academico.config.escala.title')}</h4>
          <span className='text-muted fs-7'>{t('academico.config.escala.subtitle')}</span>
        </div>
        <button type='button' className='btn btn-primary' onClick={openCreate}>
          <i className='ki-duotone ki-plus fs-2'></i>
          {t('academico.config.escala.new')}
        </button>
      </div>
      <div>
        {isLoading && (
          <div className='d-flex justify-content-center align-items-center py-10'>
            <span className='spinner-border text-primary me-3' role='status'></span>
            <span className='text-muted fs-6'>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.escala'})})}</span>
          </div>
        )}

        {isError && !isLoading && (
          <div className='alert alert-danger d-flex align-items-center my-3'>
            <i className='ki-duotone ki-information fs-2 text-danger me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span>{intl.formatMessage({id: 'common.loading'}, {name: intl.formatMessage({id: 'entity.escala'})})}</span>
          </div>
        )}

        {!isLoading && !isError && (
          <div className='table-responsive'>
            <table className='table table-row-dashed align-middle gs-0 gy-4'>
              <thead>
                <tr className='text-start text-muted fw-bold fs-7 text-uppercase gs-0'>
                  <th className='min-w-150px'>{t('common.name')}</th>
                  <th className='min-w-125px'>{t('common.field.nivel')}</th>
                  <th className='min-w-100px'>{t('academico.config.escala.col.tipo')}</th>
                  <th className='min-w-100px'>{t('academico.config.escala.col.rango')}</th>
                  <th className='min-w-100px text-end'>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className='text-gray-600 fw-semibold'>
                {escalas.map((e) => (
                  <tr key={e.url_token}>
                    <td className='text-gray-800 fw-bold'>{e.nombre}</td>
                    <td>{nivelLabel(e.nivel_educativo)}</td>
                    <td>{t(`academico.config.escala.tipo.${e.tipo}`)}</td>
                    <td>
                      {e.tipo === 'numerica' && e.valor_min !== null && e.valor_max !== null
                        ? `${e.valor_min} — ${e.valor_max}`
                        : '—'}
                    </td>
                    <td>
                      <div className='d-flex align-items-center justify-content-end flex-shrink-0'>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-primary btn-sm me-2'
                          title={intl.formatMessage({id: 'common.edit'}, {name: intl.formatMessage({id: 'entity.escala'})})}
                          onClick={() => openEdit(e)}
                        >
                          <i className='ki-duotone ki-pencil fs-6'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                        </button>
                        <button
                          type='button'
                          className='btn btn-icon btn-light-danger btn-sm'
                          title={intl.formatMessage({id: 'common.delete'}, {name: intl.formatMessage({id: 'entity.escala'})})}
                          disabled={del.isPending}
                          onClick={() => handleDelete(e)}
                        >
                          <i className='ki-duotone ki-trash fs-6'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                            <span className='path3'></span>
                            <span className='path4'></span>
                            <span className='path5'></span>
                          </i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {escalas.length === 0 && (
                  <tr>
                    <td colSpan={5} className='text-center text-muted py-10'>
                      {intl.formatMessage({id: 'common.empty'}, {name: intl.formatMessage({id: 'entity.escala'})})}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createPortal(
        <Modal
          id='kt_modal_escala'
          tabIndex={-1}
          aria-hidden='true'
          dialogClassName='modal-dialog modal-dialog-centered mw-650px'
          show={showForm}
          onHide={closeForm}
          backdrop={true}
        >
          <div className='modal-header'>
            <h2 className='fw-bold'>
              {editing
                ? t('academico.config.escala.formTitleEdit')
                : t('academico.config.escala.formTitleNew')}
            </h2>
            <div className='btn btn-sm btn-icon btn-active-color-primary' onClick={closeForm}>
              <i className='ki-duotone ki-cross fs-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
            </div>
          </div>
          {showForm && (
            <EscalaForm
              key={editing?.url_token ?? 'new'}
              anoLectivoToken={anoLectivoToken}
              escala={editing}
              onClose={closeForm}
            />
          )}
        </Modal>,
        modalsRoot
      )}
    </>
  )
}

export {EscalasCard}
