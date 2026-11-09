import {NumberInput} from '@/app/shared/components/NumberInput'
import {useCommercialText} from '../../config/planes/useCommercialText'
import {useState} from 'react'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {Link} from 'react-router-dom'
import {api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {useAuth} from '@/app/modules/auth'
import type {TemplateInput, SavedTemplate} from './plantillas.api'

export default function PresetTemplatesPage() {
  const t = useCommercialText(), client = useQueryClient(), toast = useToast()
  const {currentUser} = useAuth()
  const query = useQuery({queryKey: ['boletines', 'presets', currentUser?.tenant_channel],
    queryFn: () => api.get<{data: (TemplateInput & {key: string})[]}>('/boletines/predefinidos')})
  const [accent, setAccent] = useState('#183C67'), [size, setSize] = useState(12)
  const mutation = useMutation({mutationFn: (key: string) => api.post<{data: SavedTemplate}>(`/boletines/predefinidos/${key}`, {accent, size}),
    onSuccess: () => {void client.invalidateQueries({queryKey: ['boletines', 'plantillas']}); toast.success(t('commercial.presetSaved'))},
    onError: () => toast.error(t('common.toast.genericError'))})
  return <div className='p-6 p-lg-10'>
    <Link to='/academico/boletines'>{t('common.back')}</Link>
    <h2 className='mt-5'>{t('commercial.presets')}</h2><p>{t('commercial.presetsHelp')}</p>
    <div className='d-flex flex-wrap gap-5 my-6'>
      <label>{t('commercial.accent')}<input type='color' className='form-control mt-2' value={accent} onChange={event => setAccent(event.target.value)} /></label>
      <label>{t('commercial.textSize')}<NumberInput type='number' className='form-control mt-2' min={10} max={16} value={size} onChange={event => setSize(Number(event.target.value))} /></label>
    </div>
    {query.isError && <p role='alert'>{t('commercial.quoteError')}</p>}
    <div className='row g-6'>{query.data?.data.map(item => <div className='col-md-6 col-xl-4' key={item.key}>
      <article className='card border h-100'><div className='card-body'>
        <div className='border rounded p-5 mb-5' style={{fontSize: size, borderColor: accent, color: '#13264d'}}>
          <div className='fw-bold text-center mb-4' style={{color: accent}}>{t('commercial.schoolName')}</div>
          <hr style={{color: accent}} /><strong>{t(`commercial.preset.${item.key}`)}</strong>
          <div className='p-2 text-white mt-4' style={{background: accent}}>{t('commercial.subjectGrade')}</div>
          <div className='border-bottom p-2'>{t('commercial.sampleSubject')} · 4.0</div>
          <div className='border-bottom p-2'>{t('commercial.sampleSubject2')} · 3.8</div>
          {item.key.includes('indicadores') && <p className='mt-3'>{t('commercial.sampleIndicator')}</p>}
          <p className='mt-5'>{t('commercial.observations')}</p>
        </div>
        <h4>{t(`commercial.preset.${item.key}`)}</h4>
        <button className='btn btn-primary mt-4' type='button' disabled={mutation.isPending || size < 10 || size > 16} onClick={() => mutation.mutate(item.key)}>
          {mutation.isPending ? t('commercial.calculating') : t('commercial.usePreset')}</button>
      </div></article>
    </div>)}</div>
  </div>
}
