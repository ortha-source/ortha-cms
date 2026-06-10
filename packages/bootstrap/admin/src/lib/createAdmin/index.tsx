import { StrictMode } from 'react';
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
import { TooltipProvider, Toaster } from '@ortha-cms/design-system';
import type { CreateAdminOptions } from '../types/adminPlugin';

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
 * every other route mounts under a single pathless parent that renders the
 * `layout` a plugin contributed (or a bare `<Outlet/>`). The host is
 * auth-agnostic — it does not know that `layout` may wrap its children in a
 * gate; the contributing plugin (the shell) owns that. A `public:false` route
 * with no gating `layout` therefore renders ungated.
 */
export function createAdmin(options: CreateAdminOptions): void {
    const { plugins, rootElement = 'root', locale = 'en' } = options;

    const routes = plugins.flatMap((plugin) => plugin.routes ?? []);
    const publicRoutes = routes.filter((route) => route.public);
    const privateRoutes = routes.filter((route) => !route.public);

    // Wire every plugin's slot contributions into their target slots before
    // render, so consumers (e.g. the shell toolbar) see all contributed items.
    for (const plugin of plugins) {
        for (const contribution of plugin.slots ?? []) {
            contribution.slot._register(contribution.items);
        }
    }

    // The single layout that wraps every private route; falls back to a bare
    // outlet before any layout plugin (the shell) is registered.
    const layout = plugins.map((plugin) => plugin.layout).find(Boolean) ?? (
        <Outlet />
    );

    const root = ReactDOM.createRoot(
        document.getElementById(rootElement) as HTMLElement
    );

    root.render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <IntlProvider locale={locale} defaultLocale="en">
                    <TooltipProvider delayDuration={200}>
                        <BrowserRouter>
                            <Routes>
                                {publicRoutes.map((route) => (
                                    <Route
                                        key={route.path}
                                        path={route.path}
                                        element={route.element}
                                    />
                                ))}
                                <Route element={layout}>
                                    {privateRoutes.map((route) => (
                                        <Route
                                            key={route.path}
                                            path={route.path}
                                            element={route.element}
                                        />
                                    ))}
                                    <Route
                                        path="*"
                                        element={<Navigate to="/" replace />}
                                    />
                                </Route>
                            </Routes>
                        </BrowserRouter>
                        <Toaster position="bottom-right" />
                    </TooltipProvider>
                </IntlProvider>
            </QueryClientProvider>
        </StrictMode>
    );
}
