import type { CSSProperties } from 'react';
import { AppRouting } from '@/routing/app-routing';
import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { LoadingBarContainer } from 'react-top-loading-bar';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/api/query-client';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuthProvider } from '@/features/auth/auth-provider';
import { RealtimeProvider } from '@/features/realtime/realtime-provider';
import { NotificationsProvider } from '@/features/notifications/notifications-provider';

const { BASE_URL } = import.meta.env;

export function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="vite-theme"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <NotificationsProvider>
            <AuthProvider>
              <HelmetProvider>
              <LoadingBarContainer>
                <BrowserRouter basename={BASE_URL}>
                  <Toaster position="top-right" style={{ '--width': '384px' } as CSSProperties} />
                  <RealtimeProvider>
                    <AppRouting />
                  </RealtimeProvider>
                </BrowserRouter>
              </LoadingBarContainer>
              </HelmetProvider>
            </AuthProvider>
          </NotificationsProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
