import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import type { CreateAdminOptions } from './types/admin-plugin';

/**
 * Bootstraps the Ortha CMS admin app: mounts the React root, wraps it in
 * the i18n provider and router, and renders the routes contributed by every
 * plugin.
 *
 * Plugins author user-facing strings with `react-intl` (`defineMessages` +
 * `useIntl`), so the host provides a single `IntlProvider`. Messages are
 * resolved from each descriptor's `defaultMessage`; a translation catalogue
 * can be wired in here later without touching plugins.
 */
export function createAdmin(options: CreateAdminOptions): void {
    const { plugins, rootElement = 'root', locale = 'en' } = options;

    const routes = plugins.flatMap((plugin) => plugin.routes ?? []);

    const root = ReactDOM.createRoot(
        document.getElementById(rootElement) as HTMLElement
    );

    root.render(
        <StrictMode>
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
        </StrictMode>
    );
}
