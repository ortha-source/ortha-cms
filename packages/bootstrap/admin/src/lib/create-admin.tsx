import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { CreateAdminOptions } from './types/admin-plugin';

/**
 * Bootstraps the Ortha CMS admin app: mounts the React root, wraps it in
 * the router, and renders the routes contributed by every plugin.
 */
export function createAdmin(options: CreateAdminOptions): void {
    const { plugins, rootElement = 'root' } = options;

    const routes = plugins.flatMap((plugin) => plugin.routes ?? []);

    const root = ReactDOM.createRoot(
        document.getElementById(rootElement) as HTMLElement
    );

    root.render(
        <StrictMode>
            <BrowserRouter>
                <Routes>
                    {routes.map((route) => (
                        <Route
                            key={route.path}
                            path={route.path}
                            element={route.element}
                        />
                    ))}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </StrictMode>
    );
}
