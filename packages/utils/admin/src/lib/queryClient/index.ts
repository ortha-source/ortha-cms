import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single TanStack Query client. The host mounts it once via
 * `QueryClientProvider` (in `createAdmin`); plugins read/write server state
 * through `useQuery`/`useMutation` against it. A module singleton is fine for
 * this client-only SPA (no SSR, so no per-request isolation needed).
 */
export const queryClient = new QueryClient();
