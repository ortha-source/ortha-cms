import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';

/**
 * Identity plugin router. Renders the auth sub-routes; mounted by the plugin
 * under the `/identity` base path (see {@link IdentityPlugin}).
 */
export function IdentityRouter() {
    return (
        <Routes>
            <Route index element={<Navigate to="signin" replace />} />
            <Route path="signin" element={<LoginPage />} />
        </Routes>
    );
}
