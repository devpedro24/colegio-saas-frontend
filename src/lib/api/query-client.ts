import { QueryClient } from '@tanstack/react-query';
import {configureAcademicCache} from './academic-cache';

/** Instancia unica de React Query para toda la app. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        const status = (error as {status?: number}).status;
        return count < 1 && error.name !== 'AbortError' && !(status && status >= 400 && status < 500);
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
configureAcademicCache(queryClient);
