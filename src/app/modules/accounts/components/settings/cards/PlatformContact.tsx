import {useSedeMessages} from '@/app/pages/academico/configuracion/components/useSedeMessages'
import {useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {api} from '@/lib/api/client'
import {useToast} from '@/lib/ui/toast'
import {ContactMobileInput} from '@/lib/ui/ContactMobileInput'

type Contact = {whatsapp: string | null; url: string | null}

export function PlatformContact() {
  const t = useSedeMessages()
  const toast = useToast()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['platform-contact'],
    queryFn: () => api.get<Contact>('/platform/contact-setting')
  })
  const [phone, setPhone] = useState<string | null>(null)
  const [phoneValid, setPhoneValid] = useState(false)
  const save = useMutation({
    mutationFn: () =>
      api.put<Contact>('/platform/contact-setting', {
        whatsapp: (phone ?? query.data?.whatsapp)?.trim() || null
      }),
    onSuccess: (data) => {
      client.setQueryData(['platform-contact'], data)
      client.invalidateQueries({queryKey: ['estructura', 'sedes']})
      setPhone(null)
      toast.success(t('common.toast.updated'), 'updated')
    },
    onError: (error) => toast.error(error.message)
  })
  return (
    <section className='card mb-5'>
      <div className='card-header'>
        <h3 className='card-title'>{t('sede.contactTitle')}</h3>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!phoneValid) return
          save.mutate()
        }}
      >
        <div className='card-body'>
          <label htmlFor='platform-whatsapp' className='form-label'>
            {t('sede.contactPhone')}
          </label>
          <ContactMobileInput
            id='platform-whatsapp'
            value={phone ?? (query.data?.whatsapp ? `+${query.data.whatsapp}` : '')}
            onChange={setPhone}
            onValidityChange={setPhoneValid}
            disabled={query.isPending || save.isPending}
          />
          <p className='form-text'>{t('sede.contactConfigurationHelp')}</p>
          {query.isError && (
            <div role='alert' className='text-danger'>
              {query.error.message}
            </div>
          )}
        </div>
        <div className='card-footer text-end'>
          <button className='btn btn-primary' disabled={!query.data || save.isPending || !phoneValid}>
            {t('sede.contactSave')}
          </button>
        </div>
      </form>
    </section>
  )
}
