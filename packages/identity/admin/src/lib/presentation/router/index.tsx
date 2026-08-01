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
 * Accept-invite page, split for the same reason and then some: hardly anyone
 * loads it, and those who do load it exactly once.
 */
const AcceptInvitePage = lazy(() =>
    import('../pages/AcceptInvitePage').then((module) => ({
        default: module.AcceptInvitePage
    }))
);

/**
 * Identity plugin router. Renders the auth sub-routes; mounted by the plugin
 * under the `/identity` base path (see {@link IdentityPlugin}). The lazy pages
 * are wrapped in a `Suspense` boundary that shows the {@link LoginSkeleton}
 * while their chunk loads.
 *
 * `accept-invite` takes its token from the query string (`?token=…`) rather
 * than a path segment, so the secret never becomes part of a route pattern.
 */
export function IdentityRouter() {
    return (
        <Suspense fallback={<LoginSkeleton />}>
            <Routes>
                <Route index element={<Navigate to="signin" replace />} />
                <Route path="signin" element={<LoginPage />} />
                <Route path="accept-invite" element={<AcceptInvitePage />} />
            </Routes>
        </Suspense>
    );
}
