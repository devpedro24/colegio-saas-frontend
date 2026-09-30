import {useState, useEffect, useRef} from 'react'
import {KTCard, KTCardBody} from '@/_metronic/helpers'
import {useSiee, useCurriculo, useUpdateSiee, useUpdateCurriculo} from '../siee.api'
import {useIntl} from 'react-intl'
import {useToast} from '@/lib/ui/toast'
import type {CurriculoItem, SieeConfiguracion} from '../siee.types'
import {AcademicPagination} from '@/app/shared/components/AcademicPagination'
import {usePageSize} from '@/app/shared/hooks/usePageSize'
import {AcademicOptionSelect} from '../../shared/AcademicOptionSelect'
import {AcademicListFilters} from '../../estructura/components/AcademicListFilters'

export const SieeConfigPanel = ({anoLectivoId}: {anoLectivoId: string}) => {
  const intl = useIntl()
  const toast = useToast()
  const t = (id: string) => intl.formatMessage({id})

  const {data, isLoading, isError, error} = useSiee(anoLectivoId)
  const [currPage, setCurrPage] = useState(1)
  const [currPerPage, setCurrPerPage] = usePageSize('siee-curriculo')
  const [currSearch, setCurrSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currGrado, setCurrGrado] = useState('')
  const [currMateria, setCurrMateria] = useState('')
  const [currArea, setCurrArea] = useState('')
  const curriculo = useCurriculo(anoLectivoId, {
    page: currPage, perPage: currPerPage, search: debouncedSearch.trim(),
    gradoId: currGrado, materiaId: currMateria, areaId: currArea,
  })
  const [loadedCurriculo, setLoadedCurriculo] = useState<CurriculoItem[]>([])
  const mutation = useUpdateSiee(anoLectivoId)
  const curriculoMutation = useUpdateCurriculo(anoLectivoId)
  const editing = useRef(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(currSearch), 300)
    return () => window.clearTimeout(timeout)
  }, [currSearch])

  useEffect(() => {
    if (!curriculo.data) return
    const pageRows = curriculo.data.data
    if (curriculo.data.meta.total > 20 || currPage === 1) {
      setLoadedCurriculo(pageRows)
      return
    }
    setLoadedCurriculo(previous => {
      const merged = new Map(previous.map(row => [`${row.grado_id}:${row.materia_id}`, row]))
      pageRows.forEach(row => merged.set(`${row.grado_id}:${row.materia_id}`, row))
      return [...merged.values()]
    })
  }, [curriculo.data, currPage])

  const curriculoRows = curriculo.data?.meta.total !== undefined && curriculo.data.meta.total <= 20 && currPage > 1
    ? loadedCurriculo : curriculo.data?.data ?? []

  const [formData, setFormData] = useState<SieeConfiguracion>({
    usar_areas: false,
    modo_area: 'SIMPLE_AVERAGE',
    modo_asignatura: 'WEIGHTED_AVERAGE',
    modo_anual: 'SIMPLE_AVERAGE',
    redondeo: 'HALF_UP',
    precision_calculo: 8,
    recuperacion: 'REPLACE',
    mostrar_final: true,
    etiqueta_final: '',
    escala_id: null,
    metodo_id: null,
  })

  const [currForm, setCurrForm] = useState({
    grado_id: '',
    materia_id: '',
    area_id: '',
    peso_area: '',
  })

  useEffect(() => {
    if (data?.configuracion && !editing.current) {
      setFormData({
        ...data.configuracion,
        escala_id: data.configuracion.escala_id,
        metodo_id: data.configuracion.metodo_id,
      })
    }
  }, [data?.configuracion])

  if (isLoading) {
    return (
      <div className='card'>
        <div className='card-body text-muted p-6'>
          {t('siee.cargando')}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className='alert alert-danger'>
        {error?.message || t('common.error')}
      </div>
    )
  }

  const handleChange = <K extends keyof SieeConfiguracion>(field: K, value: SieeConfiguracion[K]) => {
    editing.current = true
    setFormData(prev => ({...prev, [field]: value}))
  }

  const handleSave = () => {
    const payload: SieeConfiguracion = {
      ...formData,
      modo_area: formData.usar_areas ? formData.modo_area : 'DISABLED',
      precision_calculo: Number(formData.precision_calculo || 4),
      escala_id: Number(formData.escala_id),
      metodo_id: Number(formData.metodo_id),
    }
    mutation.mutate(payload, {
      onSuccess: () => { editing.current = false; toast.success(t('siee.saved')) },
      onError: (err) =>
        toast.error(err?.message || t('common.error')),
    })
  }

  const handleSaveCurriculo = () => {
    if (!currForm.grado_id || !currForm.materia_id) return
    curriculoMutation.mutate(
      {
        grado_id: Number(currForm.grado_id),
        materia_id: Number(currForm.materia_id),
        area_id: currForm.area_id ? Number(currForm.area_id) : null,
        peso_area: currForm.peso_area !== '' ? Number(currForm.peso_area) : null,
      },
      {
        onSuccess: () => {
          toast.success(t('siee.curriculo_saved'))
          setCurrForm({grado_id: '', materia_id: '', area_id: '', peso_area: ''})
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const changeCurrFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setCurrPage(1)
  }

  const changeCurrSize = (size: number) => {
    setCurrPerPage(size)
    setCurrPage(1)
  }

  return (
    <div className='d-flex flex-column gap-6'>
      <KTCard>
        <div className='card-header border-0 pt-5'>
          <h3 className='card-title align-items-start flex-column'>
            <span className='card-label fw-bold fs-3 mb-1'>
              {t('siee.title')}
            </span>
            <span className='text-muted mt-1 fw-semibold fs-7'>
              {t('siee.desc')}
            </span>
          </h3>
          <div className='card-toolbar'>
            <button
              className='btn btn-primary'
              onClick={handleSave}
              disabled={mutation.isPending || !formData.escala_id || !formData.metodo_id || !formData.etiqueta_final.trim() || !data.editable}
            >
              {mutation.isPending
                ? t('siee.guardando')
                : t('siee.guardar')}
            </button>
          </div>
        </div>
        <KTCardBody>
          {!data.editable && <div className='alert alert-info'>{t('siee.locked')}</div>}
          <div className='alert alert-info'>{t('siee.pendingCapabilities')}</div>
          <fieldset disabled={!data.editable || mutation.isPending}>
          <div className='row g-5'>
            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.escala')}
              </label>
              <select
                className='form-select'
                value={formData.escala_id || ''}
                onChange={(e) => handleChange('escala_id', Number(e.target.value))}
              >
                <option value=''>{t('siee.select_escala')}</option>
                {data.escalas?.map((esc) => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nombre} ({esc.valor_min} - {esc.valor_max})
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.metodo')}
              </label>
              <select
                className='form-select'
                value={formData.metodo_id || ''}
                onChange={(e) => handleChange('metodo_id', Number(e.target.value))}
              >
                <option value=''>{t('siee.select_metodo')}</option>
                {data.metodos?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {intl.formatMessage({id: 'siee.minimum'}, {value: m.nota_minima})} ({t(`academico.config.metodo.ambito.${m.ambito}`)})
                  </option>
                ))}
              </select>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>{t('siee.usar_areas')}</label>
              <select
                className='form-select'
                value={formData.usar_areas ? 'true' : 'false'}
                onChange={(e) => {
                  const val = e.target.value === 'true'
                  handleChange('usar_areas', val)
                  if (!val) handleChange('modo_area', 'DISABLED')
                  else if (formData.modo_area === 'DISABLED')
                    handleChange('modo_area', 'WEIGHTED_AVERAGE')
                }}
              >
                <option value='true'>
                  {t('siee.usar_areas_true')}
                </option>
                <option value='false'>
                  {t('siee.usar_areas_false')}
                </option>
              </select>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.modo_area')}
              </label>
              <select
                className='form-select'
                disabled={!formData.usar_areas}
                value={formData.usar_areas ? formData.modo_area : 'DISABLED'}
                onChange={(e) => handleChange('modo_area', e.target.value as SieeConfiguracion['modo_area'])}
              >
                <option value='WEIGHTED_AVERAGE'>
                  {t('evaluacion.planilla.promedio_ponderado')}
                </option>
                <option value='SIMPLE_AVERAGE'>
                  {t('evaluacion.planilla.promedio_simple')}
                </option>
                <option value='MANUAL' disabled>{t('siee.manualPending')}</option>
                <option value='DISABLED' disabled={formData.usar_areas}>{t('siee.disabled')}</option>
              </select>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.modo_asignatura')}
              </label>
              <select
                className='form-select'
                value={formData.modo_asignatura || 'WEIGHTED_AVERAGE'}
                onChange={(e) => handleChange('modo_asignatura', e.target.value as SieeConfiguracion['modo_asignatura'])}
              >
                <option value='WEIGHTED_AVERAGE'>
                  {t('evaluacion.planilla.promedio_ponderado')}
                </option>
                <option value='SIMPLE_AVERAGE'>
                  {t('evaluacion.planilla.promedio_simple')}
                </option>
                <option value='MANUAL' disabled>{t('siee.manualPending')}</option>
              </select>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.modo_anual')}
              </label>
              <select
                className='form-select'
                value={formData.modo_anual || 'SIMPLE_AVERAGE'}
                onChange={(e) => handleChange('modo_anual', e.target.value as SieeConfiguracion['modo_anual'])}
              >
                <option value='SIMPLE_AVERAGE'>
                  {t('evaluacion.planilla.promedio_simple')}
                </option>
                <option value='WEIGHTED_AVERAGE'>
                  {t('evaluacion.planilla.promedio_ponderado')}
                </option>
                <option value='MANUAL' disabled>{t('siee.manualPending')}</option>
              </select>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.redondeo')}
              </label>
              <select
                className='form-select'
                value={formData.redondeo || 'HALF_UP'}
                onChange={(e) => handleChange('redondeo', e.target.value as SieeConfiguracion['redondeo'])}
              >
                <option value='HALF_UP'>
                  {t('siee.redondeo_half_up')}
                </option>
                <option value='TRUNCATE'>
                  {t('siee.redondeo_truncate')}
                </option>
              </select>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.precision')}
              </label>
              <input
                type='number'
                min={4}
                max={12}
                className='form-control'
                value={formData.precision_calculo ?? 4}
                onChange={(e) => handleChange('precision_calculo', Number(e.target.value))}
              />
              <div className='form-text'>
                {t(
                  'siee.precision_desc'
                )}
              </div>
            </div>

            <div className='col-md-4'>
              <label className='form-label required'>
                {t('siee.recuperacion')}
              </label>
              <select
                className='form-select'
                value={formData.recuperacion || 'REPLACE'}
                onChange={(e) => handleChange('recuperacion', e.target.value as SieeConfiguracion['recuperacion'])}
              >
                <option value='REPLACE'>
                  {t('siee.recuperacion_replace')}
                </option>
                <option value='AVERAGE'>
                  {t('siee.recuperacion_average')}
                </option>
                <option value='MAX_PASSING_GRADE'>
                  {t('siee.recuperacion_max')}
                </option>
                <option value='MANUAL'>
                  {t('siee.recuperacion_manual')}
                </option>
              </select>
            </div>

            <div className='col-md-6'>
              <label className='form-label required'>
                {t('siee.etiqueta_final')}
              </label>
              <input
                type='text'
                className='form-control'
                value={formData.etiqueta_final}
                maxLength={60}
                onChange={(e) => handleChange('etiqueta_final', e.target.value)}
              />
              <div className='form-text'>
                {t('siee.etiqueta_desc')}
              </div>
            </div>

            <div className='col-md-6'>
              <label className='form-label required'>
                {t('siee.mostrar_final')}
              </label>
              <select
                className='form-select'
                value={formData.mostrar_final ? 'true' : 'false'}
                onChange={(e) => handleChange('mostrar_final', e.target.value === 'true')}
              >
                <option value='true'>{t('siee.si')}</option>
                <option value='false'>{t('siee.no')}</option>
              </select>
            </div>
          </div>
          </fieldset>
        </KTCardBody>
      </KTCard>

      <KTCard>
        <div className='card-header border-0 pt-5'>
          <h3 className='card-title align-items-start flex-column'>
            <span className='card-label fw-bold fs-3 mb-1'>
              {t('siee.curriculo_title')}
            </span>
            <span className='text-muted mt-1 fw-semibold fs-7'>
              {t(
                'siee.curriculo_desc'
              )}
            </span>
          </h3>
        </div>
        <KTCardBody>
          <div className='row g-3 mb-6 align-items-end'>
            <div className='col-md-3'>
              <AcademicOptionSelect tipo='grados' yearId={anoLectivoId} label={t('siee.grado')}
                value={currForm.grado_id} onChange={value => setCurrForm(previous => ({...previous, grado_id: value}))}
                initialOptions={data.grados ?? []} emptyLabel='—' required selectOnly />
            </div>
            <div className='col-md-3'>
              <AcademicOptionSelect tipo='materias' yearId={anoLectivoId} label={t('siee.materia')}
                value={currForm.materia_id} onChange={value => setCurrForm(previous => ({...previous, materia_id: value}))}
                initialOptions={data.materias ?? []} emptyLabel='—' required selectOnly />
            </div>
            <div className='col-md-3'>
              <AcademicOptionSelect tipo='areas' yearId={anoLectivoId} label={t('siee.area')}
                value={currForm.area_id} onChange={value => setCurrForm(previous => ({...previous, area_id: value}))}
                initialOptions={data.areas ?? []} emptyLabel='—' selectOnly />
            </div>
            <div className='col-md-2'>
              <label className='form-label fs-7'>{t('siee.peso_area')}</label>
              <input
                type='number'
                min={0}
                max={100}
                step='0.1'
                className='form-control form-control-sm'
                value={currForm.peso_area}
                onChange={(e) => setCurrForm((p) => ({...p, peso_area: e.target.value}))}
              />
            </div>
            <div className='col-md-1'>
              <button
                className='btn btn-sm btn-primary w-100'
                onClick={handleSaveCurriculo}
                disabled={curriculoMutation.isPending || !currForm.grado_id || !currForm.materia_id || !data.editable}
                aria-label={t('siee.curriculo_save')}
              >
                +
              </button>
            </div>
          </div>

          <AcademicListFilters id='siee-curriculo-search' search={currSearch} onSearchChange={value => changeCurrFilter(setCurrSearch, value)}>
            <AcademicOptionSelect tipo='grados' yearId={anoLectivoId} label={t('siee.grado')}
              value={currGrado} onChange={value => changeCurrFilter(setCurrGrado, value)}
              initialOptions={data.grados ?? []} emptyLabel={t('academic.filter.allGrades')} selectOnly hideLabel />
            <AcademicOptionSelect tipo='materias' yearId={anoLectivoId} label={t('siee.materia')}
              value={currMateria} onChange={value => changeCurrFilter(setCurrMateria, value)}
              initialOptions={data.materias ?? []} emptyLabel={t('academic.filter.allSubjects')} selectOnly hideLabel />
            <AcademicOptionSelect tipo='areas' yearId={anoLectivoId} label={t('siee.area')}
              value={currArea} onChange={value => changeCurrFilter(setCurrArea, value)}
              initialOptions={data.areas ?? []} emptyLabel={t('academic.filter.allAreas')} selectOnly hideLabel />
          </AcademicListFilters>
          {curriculo.error && <div className='alert alert-danger' role='alert'>{curriculo.error.message}</div>}
          <div className='table-responsive' aria-busy={curriculo.isFetching}>
            <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-3'>
              <thead>
                <tr className='fw-bold text-muted'>
                  <th>{t('siee.grado')}</th>
                  <th>{t('siee.materia')}</th>
                  <th>{t('siee.area')}</th>
                  <th className='text-end'>{t('siee.peso_area')}</th>
                </tr>
              </thead>
              <tbody>
                {curriculoRows.map((c, idx: number) => {
                  const grado = data.grados?.find((g) => g.id === c.grado_id)
                  const materia = data.materias?.find((m) => m.id === c.materia_id)
                  const area = data.areas?.find((a) => a.id === c.area_id)
                  return (
                    <tr key={`${c.grado_id}-${c.materia_id}-${idx}`}>
                      <td className='fw-semibold'>{c.grado_nombre ?? grado?.nombre ?? c.grado_id}</td>
                      <td>{c.materia_nombre ?? materia?.nombre ?? c.materia_id}</td>
                      <td>{c.area_nombre ?? area?.nombre ?? '—'}</td>
                      <td className='text-end'>{c.peso_area != null ? `${c.peso_area}%` : '—'}</td>
                    </tr>
                  )
                })}
                {curriculo.isPending && <tr><td colSpan={4} className='text-center text-muted py-6'>{t('common.loading')}</td></tr>}
                {!curriculo.isPending && curriculoRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className='text-center text-muted py-6'>
                      {t('siee.no_curriculo')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <AcademicPagination meta={curriculo.data?.meta} visibleCount={curriculoRows.length}
            loading={curriculo.isFetching} onPageChange={setCurrPage} onPerPageChange={changeCurrSize}
            onLoadMore={() => setCurrPage(page => page + 1)} />
        </KTCardBody>
      </KTCard>
    </div>
  )
}
