import {useState} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useLocation, useNavigate, useParams} from 'react-router-dom'
import {api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {CampaignEditor} from './CampaignEditor'
import {IntakeNotice} from './IntakeUI'
import {useEnrollmentScope} from './enrollmentSettings.api'
import {useIntakeText} from './intakeWorkflow'
import type {CampaignInput, Catalog} from './ingreso.types'

export default function CampaignPage() {
  const {token} = useParams(), {pathname} = useLocation(), navigate = useNavigate()
  const scope = useEnrollmentScope(), qc = useQueryClient(), toast = useToast(), t = useIntakeText()
  const [busy, setBusy] = useState(false)
  const duplicate = pathname.endsWith('/reutilizar')
  const catalog = useQuery({queryKey: ['ingreso', scope, 'catalogo'],
    queryFn: () => api.get<Catalog>('/ingreso/catalogo'), staleTime: 30000})
  const close = () => navigate('/admisiones/convocatorias')
  async function save(form: CampaignInput) {
    if (busy) return
    setBusy(true)
    try {
      if (token && !duplicate) await api.put(`/ingreso/campanas/${token}`, form)
      else await api.post('/ingreso/campanas', form)
      await qc.invalidateQueries({queryKey: ['ingreso', scope]})
      toast.success(t('saved'))
      close()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('failed'))
    } finally {setBusy(false)}
  }
  if (catalog.error) return <IntakeNotice kind='danger'>{catalog.error.message}</IntakeNotice>
  if (!catalog.data) return <IntakeNotice>{t('loading')}</IntakeNotice>
  const initial = catalog.data.campanas.find(c => c.url_token === token)
  if (token && !initial) return <IntakeNotice kind='warning'>{t('campaignNotFound')} <button className='btn btn-sm btn-light' onClick={close}>{t('backCampaigns')}</button></IntakeNotice>
  return <CampaignEditor key={`${token ?? 'new'}-${duplicate}`} catalog={catalog.data} initial={initial} duplicate={duplicate} busy={busy} save={save} close={close} />
}
