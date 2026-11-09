// Browser-only fixture: real notification provider, no authentication or API writes.
import {createRoot} from 'react-dom/client'
import {ToastProvider, useToast, type ToastVariant} from '../../src/lib/ui/toast'
import {MetronicI18nProvider, useLang, setLanguage} from '../../src/_metronic/i18n/Metronici18n'
import '../../src/_metronic/assets/sass/style.scss'

function Preview() {
  const toast = useToast(), lang = useLang()
  const variants: ToastVariant[] = ['success','updated','warning','danger','info','deleted']
  const text = lang === 'es'
    ? ['Colegio creado correctamente.','Cambios guardados.','Revisa los campos obligatorios.','No se pudo guardar. Inténtalo más tarde.','Hay una nueva solicitud.','Registro eliminado.']
    : ['School created successfully.','Changes saved.','Check the required fields.','Could not save. Please try again later.','There is a new application.','Record deleted.']
  return <main style={{minHeight:'100vh',background:'#f8f3ef',padding:24}}>
    <header style={{background:'#6d23ff',padding:'20px 24px',borderRadius:20,color:'white',marginBottom:24,fontWeight:600}}>Colegio SaaS</header>
    <section className='card'><div className='card-body'><h1>Avisos</h1><p className='text-muted'>Prueba aislada de las notificaciones compartidas.</p>
      <div className='d-flex flex-wrap gap-3'>{variants.map((kind,index)=><button key={kind} data-toast-kind={kind} className='btn btn-light-primary' onClick={()=>toast.show(text[index],kind)}>{kind}</button>)}</div>
      <button id='toast-long' className='btn btn-light mt-4' onClick={()=>toast.info('La información del colegio se actualizó correctamente. Puedes continuar con las demás configuraciones sin perder los cambios guardados.')}>Mensaje largo</button>
      <button id='toast-escaped' className='btn btn-light mt-4' onClick={()=>toast.info('<b>Texto literal</b>')}>Texto literal</button>
      <select aria-label='Idioma' className='form-select mt-4' style={{maxWidth:180}} value={lang} onChange={e=>setLanguage(e.target.value)}><option value='es'>Español</option><option value='en'>English</option></select>
    </div></section>
  </main>
}

createRoot(document.getElementById('root')!).render(<MetronicI18nProvider><ToastProvider><Preview /></ToastProvider></MetronicI18nProvider>)
