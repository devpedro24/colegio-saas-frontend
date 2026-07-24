import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { MENU_SIDEBAR } from '@/config/dashboard.config';
import { useMenu } from '@/hooks/use-menu';
import { Wrapper } from './components/wrapper';
import { LayoutProvider } from './components/context';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const { getCurrentItem } = useMenu(pathname);
  const item = getCurrentItem(MENU_SIDEBAR);
  const intl = useIntl();

  return (
    <>
      <Helmet>
        <title>{item?.title ? intl.formatMessage({ id: item.title }) : ''}</title>
      </Helmet>

      <LayoutProvider
        bodyClassName="bg-zinc-950 lg:overflow-hidden"
        style={{
          '--sidebar-width': '240px',
          '--sidebar-width-mobile': '100px',
          '--header-height': '60px',
          '--header-height-mobile': '60px',
        } as React.CSSProperties}
      >
        <Wrapper />
      </LayoutProvider>
    </>
  );
}
