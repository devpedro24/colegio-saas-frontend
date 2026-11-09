import {useSedeMessages} from './useSedeMessages'
import {useState, type FormEvent} from 'react'
import {Modal} from 'react-bootstrap'
import {useQuery} from '@tanstack/react-query'
import {api, ApiError} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {sedeSubdomainUrl, useCreateSede, useUpdateSede} from '../../estructura/estructura.api'
import type {CreateSedeInput, Sede} from '../../estructura/estructura.types'
import type {Department} from '../../../admisiones/EnrollmentAddress'
import {ContactMobileInput} from '@/lib/ui/ContactMobileInput'

type Options = {
  capacidad: {contratados: number | null; asignados: number; disponibles: number | null}
  contacto: {whatsapp: string | null; url: string | null}
  matriculados: number
  coordinadores: {url_token: string; nombre: string; correo: string; rol: string}[]
  colegio: string
  celular_pais: string
  departamentos: Department[]
  dominio: string
  dependencias: Record<string, string[]>
}
const categories = [
  'anos',
  'periodos',
  'niveles',
  'grados',
  'jornadas',
  'bloques',
  'grupos',
  'espacios',
  'escalas',
  'metodos',
  'modelos',
  'datos'
]

export function SedeFormDialog({
  sede,
  onClose,
  schoolSlug
}: {
  sede: Sede | null
  onClose: (saved?: Sede) => void
  schoolSlug?: string
}) {
  const t = useSedeMessages()
  const toast = useToast()
  const create = useCreateSede(schoolSlug)
  const update = useUpdateSede(schoolSlug)
  const pending = create.isPending || update.isPending
  const options = useQuery({
    queryKey: ['estructura', 'sedes', 'options', schoolSlug ?? 'tenant', sede?.id ?? 'new'],
    queryFn: () =>
      api.get<Options>(
        `${schoolSlug ? `/colegios/${encodeURIComponent(schoolSlug)}` : '/estructura'}/sedes/opciones?opaque=1${sede ? `&sede_token=${encodeURIComponent(sede.id)}` : ''}`
      ),
    staleTime: 0
  })
  const [form, setForm] = useState<CreateSedeInput>({
    nombre: sede?.nombre ?? '',
    slug: sede?.slug ?? sede?.tenant_slug ?? '',
    direccion: sede?.direccion ?? '',
    telefono: sede?.telefono ?? '',
    departamento: sede?.departamento ?? '',
    municipio: sede?.municipio ?? '',
    coordinador_token: sede?.coordinador_token ?? null,
    estado: sede?.estado ?? 'activa',
    heredar: false,
    categorias: []
  })
  const [capacity, setCapacity] = useState(
    sede?.capacidad_maxima == null ? '' : String(sede.capacidad_maxima)
  )
  const [error, setError] = useState<ApiError | null>(null)
  const [phoneValid, setPhoneValid] = useState(false)
  const set = (patch: Partial<CreateSedeInput>) => setForm((previous) => ({...previous, ...patch}))
  const available = options.data?.capacidad.disponibles
  const exceeds = available != null && Number(capacity) > available
  const belowEnrolled = capacity !== '' && Number(capacity) < (options.data?.matriculados ?? 0)
  const capacityError = exceeds
    ? t('sede.capacityExceeded', {available: available ?? 0})
    : belowEnrolled
      ? t('sede.capacityEnrolled', {count: options.data?.matriculados ?? 0})
      : error?.fieldError('capacidad_maxima')
  const municipalities =
    options.data?.departamentos.find((department) => department.codigo === form.departamento)
      ?.municipios ?? []
  const selectedCoordinator = options.data?.coordinadores.find((item) => item.url_token === form.coordinador_token)
  const principal = sede?.principal ?? (!!sede && !sede.tenant_slug)
  const base = options.data?.dominio ?? window.location.hostname
  const preview = form.slug
    ? sedeSubdomainUrl(principal ? base.replace(/^[^.]+/, form.slug) : `${form.slug}.${base}`)
    : ''
  const contactUrl = options.data?.contacto.url ? new URL(options.data.contacto.url) : null
  if (contactUrl && options.data) {
    contactUrl.searchParams.set('text', t('sede.contactMessage', {
      school: options.data.colegio,
      campus: form.nombre.trim() || t('sede.create'),
      contracted: options.data.capacidad.contratados ?? 0,
      allocated: options.data.capacidad.asignados,
      available: available ?? 0,
      requested: Number(capacity),
      total: options.data.capacidad.asignados + Number(capacity),
      increase: Math.max(0, Number(capacity) - (available ?? 0))
    }))
  }

  const toggleCategory = (category: string) => {
    const selected = new Set(form.categorias)
    const dependencies = options.data?.dependencias ?? {}
    if (selected.has(category)) {
      selected.delete(category)
      for (const item of categories) {
        if ((dependencies[item] ?? []).some((dependency) => !selected.has(dependency)))
          selected.delete(item)
      }
    } else {
      selected.add(category)
      for (const dependency of dependencies[category] ?? []) selected.add(dependency)
    }
    set({categorias: [...selected]})
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (exceeds || belowEnrolled || !options.data || pending || !phoneValid) return
    setError(null)
    const input = {...form, capacidad_maxima: Number(capacity)}
    const callbacks = {
      onSuccess: (result: {data: Sede}) => {
        toast.success(
          t(sede ? 'common.toast.updated' : 'common.toast.created'),
          sede ? 'updated' : undefined
        )
        onClose(result.data)
        if (principal && !schoolSlug && result.data.tenant_domain && form.slug !== sede?.slug) {
          window.location.assign(`${sedeSubdomainUrl(result.data.tenant_domain)}/auth/login`)
        }
      },
      onError: (failure: unknown) => {
        if (failure instanceof ApiError) setError(failure)
        if (failure instanceof ApiError && failure.fieldError('capacidad_maxima')) options.refetch()
        toast.error(failure instanceof Error ? failure.message : t('common.toast.saveError'))
      }
    }
    if (sede) update.mutate({id: sede.id, input}, callbacks)
    else create.mutate(input, callbacks)
  }
  const fieldError = (field: string) =>
    error?.fieldError(field) && (
      <div className='text-danger fs-7 mt-1' role='alert'>
        {error.fieldError(field)}
      </div>
    )

  return (
    <Modal
      show
      onHide={() => !pending && onClose()}
      centered
      scrollable
      dialogClassName='mw-750px'
      backdrop={pending ? 'static' : true}
    >
      <Modal.Header closeButton={!pending}>
        <Modal.Title>{t(sede ? 'sede.edit' : 'sede.create')}</Modal.Title>
      </Modal.Header>
      <form onSubmit={submit} className='d-flex flex-column overflow-hidden'>
        <Modal.Body className='p-6 p-md-8'>
          {options.isPending && (
            <div role='status' className='text-muted mb-5'>
              {t('sede.loading')}
            </div>
          )}
          {options.isError && (
            <div className='alert alert-danger' role='alert'>
              {t('sede.loadError')}{' '}
              <button
                type='button'
                className='btn btn-sm btn-light'
                onClick={() => options.refetch()}
              >
                {t('sede.retry')}
              </button>
            </div>
          )}
          <div className='row g-5'>
            <div className='col-md-6'>
              <label htmlFor='sede-name' className='form-label required'>
                {t('colegios.sedes.field.name')}
              </label>
              <input
                id='sede-name'
                required
                maxLength={120}
                placeholder={t('sede.nameExample')}
                className='form-control form-control-solid'
                value={form.nombre}
                onChange={(event) => set({nombre: event.target.value})}
              />
              {fieldError('nombre')}
            </div>
            <div className='col-md-6'>
              <label htmlFor='sede-slug' className='form-label required'>
                {t('academico.estructura.sede.slug')}
              </label>
              <input
                id='sede-slug'
                required
                maxLength={63}
                placeholder={t('sede.slugExample')}
                pattern='[a-z0-9]+(-[a-z0-9]+)*'
                className='form-control form-control-solid'
                value={form.slug}
                onChange={(event) => set({slug: event.target.value.toLowerCase()})}
              />
              {fieldError('slug')}
            </div>
            {preview && <div className='col-12 text-muted fs-7 text-break mt-2'>{preview}</div>}
            <div className='col-md-6'>
              <label htmlFor='sede-department' className='form-label'>
                {t('sede.department')}
              </label>
              <select
                id='sede-department'
                className='form-select form-select-solid'
                value={form.departamento ?? ''}
                onChange={(event) =>
                  set({departamento: event.target.value || null, municipio: null})
                }
              >
                <option value=''>{t('sede.select')}</option>
                {options.data?.departamentos.map((item) => (
                  <option key={item.codigo} value={item.codigo}>
                    {item.nombre}
                  </option>
                ))}
              </select>
              {fieldError('departamento')}
            </div>
            <div className='col-md-6'>
              <label htmlFor='sede-city' className='form-label'>
                {t('sede.city')}
              </label>
              <select
                id='sede-city'
                required={!!form.departamento}
                disabled={!form.departamento}
                style={!form.departamento ? {backgroundColor: 'var(--bs-gray-200)', color: 'var(--bs-gray-500)', cursor: 'not-allowed', opacity: .7} : undefined}
                className='form-select form-select-solid'
                value={form.municipio ?? ''}
                onChange={(event) => set({municipio: event.target.value || null})}
              >
                <option value=''>{t('sede.select')}</option>
                {municipalities.map((item) => (
                  <option key={item.codigo} value={item.codigo}>
                    {item.nombre}
                  </option>
                ))}
              </select>
              {fieldError('municipio')}
            </div>
            <div className='col-md-6'>
              <label htmlFor='sede-address' className='form-label'>
                {t('common.address')}
              </label>
              <input
                id='sede-address'
                maxLength={255}
                placeholder={t('sede.addressExample')}
                className='form-control form-control-solid'
                value={form.direccion ?? ''}
                onChange={(event) => set({direccion: event.target.value})}
              />
              {fieldError('direccion')}
            </div>
            <div className='col-md-6'>
              <label htmlFor='sede-phone' className='form-label'>
                {t('common.phone')}
              </label>
              <ContactMobileInput
                id='sede-phone'
                value={form.telefono ?? ''}
                fixedCountry={options.data?.celular_pais ?? 'CO'}
                onChange={(value) => set({telefono: value})}
                onValidityChange={setPhoneValid}
                disabled={pending || !options.data}
              />
              {fieldError('telefono')}
            </div>
            <div className='col-12'>
              <label htmlFor='sede-coordinator' className='form-label'>
                {t('academico.sede.detail.coordinador')}
              </label>
              <select
                id='sede-coordinator'
                className='form-select form-select-solid'
                value={form.coordinador_token ?? ''}
                onChange={(event) => set({coordinador_token: event.target.value || null})}
              >
                <option value=''>{t('sede.noCoordinator')}</option>
                {options.data?.coordinadores.map((item) => (
                  <option key={item.url_token} value={item.url_token}>
                    {item.nombre} · {item.correo} ({t(`sede.role.${item.rol}`)})
                  </option>
                ))}
              </select>
              <div className='form-text'>
                {selectedCoordinator ? t(`sede.role.${selectedCoordinator.rol}`) : t('sede.coordinatorHelp')}
              </div>
              {fieldError('coordinador_token')}
            </div>
            <div className='col-md-6'>
              <label htmlFor='sede-status' className='form-label'>
                {t('common.status')}
              </label>
              <select
                id='sede-status'
                className='form-select form-select-solid'
                value={form.estado}
                onChange={(event) => set({estado: event.target.value})}
              >
                <option value='activa'>{t('common.active')}</option>
                <option value='inactiva'>{t('common.inactive')}</option>
                <option value='mantenimiento'>{t('sede.maintenance')}</option>
              </select>
              <div className='form-text'>{t(`sede.state.${form.estado}`)}</div>
              {fieldError('estado')}
            </div>
            <div className='col-md-6'>
              <label htmlFor='sede-capacity' className='form-label required'>
                {t('sede.capacity')}
              </label>
              <input
                id='sede-capacity'
                type='number'
                min={Math.max(1, options.data?.matriculados ?? 0)}
                step={1}
                required
                placeholder={t('sede.capacityExample')}
                className={`form-control form-control-solid ${capacityError ? 'is-invalid' : ''}`}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value.replace(/^0+(?=\d)/, ''))}
                aria-describedby='sede-capacity-help'
              />
              <div id='sede-capacity-help' className='form-text'>
                {options.data &&
                  t('sede.capacityHelp', {
                    allocated: options.data.capacidad.asignados,
                    available: available ?? '∞'
                  })}
              </div>
              {capacityError && (
                <div className='text-danger fs-7 mt-2' role='alert'>
                  {capacityError}
                </div>
              )}
              {exceeds && (
                <div className='text-muted fs-7 mt-2'>
                  {options.data?.contacto.url ? (
                    <a
                      href={contactUrl?.toString()}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='btn btn-sm btn-light-primary mt-2'
                    >
                      {t('sede.contact')}
                    </a>
                  ) : (
                    t('sede.contactHelp')
                  )}
                </div>
              )}
            </div>
            {!principal && (
              <div className='col-12 border-top pt-5 mt-6'>
                <label className='form-check form-switch form-check-custom form-check-solid'>
                  <input
                    type='checkbox'
                    className='form-check-input'
                    checked={form.heredar}
                    onChange={(event) => set({heredar: event.target.checked})}
                  />
                  <span className='form-check-label text-gray-800 fw-semibold'>
                    {t('academico.estructura.sede.heredar')}
                  </span>
                </label>
                {form.heredar && (
                  <>
                    <p className='text-muted fs-7 mt-3'>{t('sede.inheritHelp')}</p>
                    <label className='form-check form-check-custom form-check-solid mb-5'>
                      <input
                        id='sede-inherit-all'
                        className='form-check-input'
                        type='checkbox'
                        checked={categories.every((category) => form.categorias?.includes(category))}
                        ref={(element) => {
                          if (element) element.indeterminate = !!form.categorias?.length && form.categorias.length < categories.length
                        }}
                        onChange={(event) => set({categorias: event.target.checked ? [...categories] : []})}
                      />
                      <span className='form-check-label fw-semibold text-gray-800'>{t('sede.selectAll')}</span>
                    </label>
                    <div className='row g-4'>
                      {categories.map((category) => (
                        <div key={category} className='col-sm-6'>
                          <label className='form-check form-check-custom form-check-solid'>
                            <input
                              className='form-check-input'
                              type='checkbox'
                              checked={form.categorias?.includes(category)}
                              onChange={() => toggleCategory(category)}
                            />
                            <span className='form-check-label text-gray-700'>
                              {t(`sede.inherit.${category}`)}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                    {fieldError('categorias')}
                  </>
                )}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type='button' className='btn btn-light' disabled={pending} onClick={() => onClose()}>
            {t('common.cancel')}
          </button>
          <button
            type='submit'
            className='btn btn-primary'
            disabled={
              pending ||
              !options.data ||
              !phoneValid ||
              exceeds ||
              belowEnrolled ||
              (form.heredar && !form.categorias?.length)
            }
          >
            {pending ? <span className='spinner-border spinner-border-sm' /> : t('sede.save')}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
