import { QueryClient } from '@tanstack/react-query';

/**
 * Shared query client. staleTime keeps recently-fetched data warm so navigating
 * back to a screen shows it instantly instead of a spinner; one retry smooths
 * over transient network blips.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
