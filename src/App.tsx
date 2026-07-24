import { AppRouting } from '@/routing/app-routing';
import { ThemeProvider } from 'next-themes';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { LoadingBarContainer } from 'react-top-loading-bar';
import { Toaster } from '@/components/ui/sonner';
import { I18nProvider } from '@/i18n/i18n-provider';

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
      <I18nProvider>
        <HelmetProvider>
          <LoadingBarContainer>
            <BrowserRouter basename={BASE_URL}>
              <Toaster />
              <AppRouting />
            </BrowserRouter>
          </LoadingBarContainer>
        </HelmetProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
