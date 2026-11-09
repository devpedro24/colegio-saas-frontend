import {lazy, Suspense, useEffect, useRef, useState} from 'react'
import {useIntl} from 'react-intl'
import {MenuComponent} from '../../../assets/ts/components'
import {toAbsoluteUrl} from '../../../helpers'
import {NAVBAR_DROPDOWN_WIDTH_CLASSES} from './_NavbarContent'
import {useAuth} from '@/app/modules/auth/core/Auth'
import {useImpersonation} from '@/app/modules/impersonation/impersonation.store'
import {useAuthz} from '@/app/modules/auth/core/authz'

const NotificationRecords = lazy(() => import('./NotificationRecords'))
const NotificationUpdates = lazy(() => import('./NotificationUpdates'))

const tabs = ['alerts', 'updates', 'logs'] as const

/** The same notification dropdown for platform, school and teaching accounts. */
export function NotificationsMenu() {
  const intl = useIntl()
  const t = (id: string) => intl.formatMessage({id: `header.notifications.${id}`})
  const trigger = useRef<HTMLButtonElement>(null)
  const [active, setActive] = useState<typeof tabs[number]>('updates')
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const {currentUser} = useAuth()
  const {activeColegio} = useImpersonation()
  const {hasFeature, hasPermission} = useAuthz()
  const canReadRecords = !!currentUser && (!currentUser.is_platform || !!activeColegio)
  const canReadUpdates = canReadRecords && (
    hasFeature('comunicacion_basica') ||
    (hasFeature('aula') && ['aula.ver_todas', 'aula.ver_asignadas', 'aula.ver_propias'].some(hasPermission)) ||
    (hasFeature('asistencia') && ['asistencia.consultar_propia', 'asistencia.justificar_propia',
      'asistencia.registrar_clases', 'asistencia.consultar_grupo'].some(hasPermission)))
  const scope = `${activeColegio?.slug ?? currentUser?.tenant_channel ?? ''}:${currentUser?.id ?? ''}`
  useEffect(() => {setPage(1); setTotal(0)}, [scope])
  const activate = (tab: typeof tabs[number]) => {setPage(1); setTotal(0); setActive(tab)}

  useEffect(() => {
    MenuComponent.bootstrap()
    const button = trigger.current!
    const menu = MenuComponent.getInstance(button)
    const shown = menu?.on('kt.menu.dropdown.shown', () => setExpanded(true))
    const hidden = menu?.on('kt.menu.dropdown.hidden', () => setExpanded(false))
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu?.isItemSubShown(button)) {
        menu.hide(button)
        button.focus()
      }
    }
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('keydown', escape)
      if (shown) menu?.off('kt.menu.dropdown.shown', shown)
      if (hidden) menu?.off('kt.menu.dropdown.hidden', hidden)
      menu?.hide(button)
    }
  }, [])

  return <div className='app-navbar-item ms-1 ms-lg-3'>
    <button ref={trigger} type='button' aria-label={t('title')} aria-expanded={expanded}
      aria-controls='kt_menu_notifications'
      className='btn btn-icon btn-custom btn-color-white btn-active-color-primary w-35px h-35px w-md-40px h-md-40px'
      data-kt-menu-trigger="{default: 'click', lg: 'hover'}" data-kt-menu-attach='parent' data-kt-menu-placement='bottom-end'>
      <i className='ki-duotone ki-notification-bing fs-1' aria-hidden='true'>
        <span className='path1' /><span className='path2' /><span className='path3' />
      </i>
    </button>
    <div id='kt_menu_notifications' data-kt-menu='true' data-testid='notifications-menu'
      className={`menu menu-sub menu-sub-dropdown menu-column ${NAVBAR_DROPDOWN_WIDTH_CLASSES}`}>
      <div className='d-flex flex-column bgi-no-repeat rounded-top'
        style={{backgroundImage:`url('${toAbsoluteUrl('media/misc/menu-header-bg.jpg')}')`}}>
        <h3 className='text-white fw-semibold px-9 mt-3 mt-sm-10 mb-3 mb-sm-6'>
          {t('title')}<span className='fs-8 opacity-75 ps-3'>
            {intl.formatMessage({id:'header.notifications.reportsCount'}, {count:total})}
          </span>
        </h3>
        <ul className='nav nav-line-tabs nav-line-tabs-2x nav-stretch fw-semibold px-9' role='tablist' aria-label={t('title')}>
          {tabs.map(tab => <li className='nav-item' role='presentation' key={tab}>
            <button type='button' role='tab' id={`notifications-tab-${tab}`} aria-selected={active===tab}
              aria-controls='notifications-panel' tabIndex={active===tab ? 0 : -1}
              className={`nav-link text-white opacity-75 opacity-state-100 pb-4${active===tab ? ' active' : ''}`}
              onClick={() => activate(tab)} onKeyDown={event => {
                if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
                event.preventDefault()
                const index = event.key==='Home' ? 0 : event.key==='End' ? 2 : (tabs.indexOf(tab)+(event.key==='ArrowRight'?1:2))%3
                activate(tabs[index])
                document.getElementById(`notifications-tab-${tabs[index]}`)?.focus()
              }}>{t(tab)}</button>
          </li>)}
        </ul>
      </div>
      <div className='tab-content'>
        <div id='notifications-panel' role='tabpanel' aria-labelledby={`notifications-tab-${active}`}>
          <div className='scroll-y h-325px my-5 px-8' style={{maxHeight:'calc(100dvh - 220px)'}}>
            {active === 'logs' && canReadRecords ? expanded && <Suspense fallback={<div className='text-center py-10' role='status'>{t('loading')}</div>}>
              <NotificationRecords scope={scope} page={page} setPage={setPage} onTotal={setTotal} />
            </Suspense> : active === 'updates' && canReadUpdates ? expanded && <Suspense fallback={<div className='text-center py-10' role='status'>{t('loading')}</div>}>
              <NotificationUpdates scope={scope} page={page} setPage={setPage} onTotal={setTotal}
                onOpen={() => {if (trigger.current) MenuComponent.getInstance(trigger.current)?.hide(trigger.current)}} />
            </Suspense> : <div className='d-flex flex-column flex-center text-center py-10 h-100'>
              <span className='symbol symbol-50px mb-4'><span className='symbol-label bg-light-primary'>
                <i className='ki-solid ki-notification-bing fs-2x text-primary' aria-hidden='true' />
              </span></span>
              <p className='fw-semibold text-gray-900 mb-2'>{t('empty')}</p>
              <p className='text-muted mb-0'>{t('emptyHelp')}</p>
            </div>}
          </div>
        </div>
      </div>
    </div>
  </div>
}
