import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@ortha-cms/utils-admin';
import type { CreateAdminOptions } from './types/admin-plugin';

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
 */
export function createAdmin(options: CreateAdminOptions): void {
    const { plugins, rootElement = 'root', locale = 'en' } = options;

    const routes = plugins.flatMap((plugin) => plugin.routes ?? []);

    const root = ReactDOM.createRoot(
        document.getElementById(rootElement) as HTMLElement
    );

    root.render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <IntlProvider locale={locale} defaultLocale="en">
                    <BrowserRouter>
                        <Routes>
                            {routes.map((route) => (
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
                        </Routes>
                    </BrowserRouter>
                </IntlProvider>
            </QueryClientProvider>
        </StrictMode>
    );
}
