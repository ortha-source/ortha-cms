import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginSkeleton } from '../components/LoginSkeleton';

/**
 * Login page, code-split so its bundle (form, schema, validation) loads only
 * when a user actually reaches `/identity/signin` — it isn't needed for an
 * already-authenticated session. `React.lazy` wants a default export, so the
 * named `LoginPage` is adapted here; the dynamic `import()` is what lets the
 * bundler split it into its own chunk, so it must be the module's only importer.
 */
const LoginPage = lazy(() =>
    import('../pages/LoginPage').then((module) => ({
        default: module.LoginPage
    }))
);

/**
 * Identity plugin router. Renders the auth sub-routes; mounted by the plugin
 * under the `/identity` base path (see {@link IdentityPlugin}). The lazy login
 * page is wrapped in a `Suspense` boundary that shows the {@link LoginSkeleton}
 * while its chunk loads.
 */
export function IdentityRouter() {
    return (
        <Suspense fallback={<LoginSkeleton />}>
            <Routes>
                <Route index element={<Navigate to="signin" replace />} />
                <Route path="signin" element={<LoginPage />} />
            </Routes>
        </Suspense>
    );
}
