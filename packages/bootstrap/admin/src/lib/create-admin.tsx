import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
    BrowserRouter,
    Navigate,
    Outlet,
    Route,
    Routes
} from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@ortha-cms/utils-admin';
import type { CreateAdminOptions } from './types/admin-plugin';
import { RequireAuth } from './auth/require-auth';

/**
 * Bootstraps the Ortha CMS admin app: mounts the React root, wraps it in
 * the data, i18n, and router providers, and renders the routes contributed by
 * every plugin.
 *
 * Plugins author user-facing strings with `react-intl` (`defineMessages` +
 * `useIntl`), so the host provides a single `IntlProvider`. Messages are
 * resolved from each descriptor's `defaultMessage`; a translation catalogue
 * can be wired in here later without touching plugins.
 *
 * Server state is fetched with TanStack Query, so the host also provides one
 * `QueryClient`. Plugins call `useQuery`/`useMutation` (e.g. identity's
 * `useLoginMutation`) without owning a client of their own.
 *
 * Routes split by `public`: public routes mount as top-level siblings, while
 * every other route mounts under a single pathless parent guarded by
 * {@link RequireAuth}. That parent renders the authenticated shell (the first
 * plugin-provided `layout`, or a bare `<Outlet/>`), so all private pages render
 * inside it and share one auth check.
 */
export function createAdmin(options: CreateAdminOptions): void {
    const {
        plugins,
        rootElement = 'root',
        locale = 'en',
        signInPath = '/identity/signin'
    } = options;

    const routes = plugins.flatMap((plugin) => plugin.routes ?? []);
    const publicRoutes = routes.filter((route) => route.public);
    const privateRoutes = routes.filter((route) => !route.public);

    // App-level providers (e.g. identity's auth-state provider), nested in order.
    const providers = plugins
        .map((plugin) => plugin.provider)
        .filter((provider): provider is NonNullable<typeof provider> =>
            Boolean(provider)
        );

    // The single authenticated shell; falls back to a bare outlet before any
    // shell plugin is registered.
    const layout = plugins.map((plugin) => plugin.layout).find(Boolean) ?? (
        <Outlet />
    );

    const tree = providers.reduceRight<ReactNode>(
        (children, Provider) => <Provider>{children}</Provider>,
        <Routes>
            {publicRoutes.map((route) => (
                <Route
                    key={route.path}
                    path={route.path}
                    element={route.element}
                />
            ))}
            <Route
                element={
                    <RequireAuth signInPath={signInPath}>{layout}</RequireAuth>
                }
            >
                {privateRoutes.map((route) => (
                    <Route
                        key={route.path}
                        path={route.path}
                        element={route.element}
                    />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );

    const root = ReactDOM.createRoot(
        document.getElementById(rootElement) as HTMLElement
    );

    root.render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <IntlProvider locale={locale} defaultLocale="en">
                    <BrowserRouter>{tree}</BrowserRouter>
                </IntlProvider>
            </QueryClientProvider>
        </StrictMode>
    );
}
