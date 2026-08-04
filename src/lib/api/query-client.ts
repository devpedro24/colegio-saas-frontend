import { QueryClient } from '@tanstack/react-query';

/** Instancia unica de React Query para toda la app. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
