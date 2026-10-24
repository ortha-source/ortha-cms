import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import {
    AuthStatus,
    useAuth,
    useHasPermission
} from '@orthacms/identity-admin';
import { UserDetailLayout } from '../UserDetailLayout';
import { UserOverviewPage } from '../../pages/UserOverviewPage';
import { UserWorkspacesPage } from '../../pages/UserWorkspacesPage';
import { UserActivityPage } from '../../pages/UserActivityPage';
import { UserAccessPage } from '../../pages/UserAccessPage';
import { UserPreferencesPage } from '../../pages/UserPreferencesPage';

/**
 * The nested router for one member, mounted by the plugin at `/users/:id/*`.
 * A single element owning its own `<Routes>`, with the shared layout wrapping
 * the tab pages and providing the member via Outlet context.
 *
 * Four tabs: **Overview** (the index), **Workspaces**, **Sessions & access**
 * (`users:update`) and **Activity** (`activity:read`). Without the permission a
 * gated route redirects to Overview, so a deep link or stale bookmark can't
 * reach a tab the bar hides. **Preferences** is self-only and redirects on
 * anyone else's page.
 *
 * The seven-tab era's paths still resolve, so old links and bookmarks land
 * somewhere sensible: `general` and `roles` on Overview (role is changed from
 * the header now), `sessions` on Sessions & access.
 */
export function UserDetailRouter() {
    const canManage = useHasPermission('users:update');
    const canReadActivity = useHasPermission('activity:read');
    const { id } = useParams<{ id: string }>();
    const auth = useAuth();
    const isSelf =
        auth.status === AuthStatus.Authenticated && auth.user.id === id;

    return (
        <Routes>
            <Route element={<UserDetailLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<UserOverviewPage />} />
                <Route path="workspaces" element={<UserWorkspacesPage />} />
                <Route
                    path="access"
                    element={
                        canManage ? (
                            <UserAccessPage />
                        ) : (
                            <Navigate to="../overview" replace />
                        )
                    }
                />
                <Route
                    path="activity"
                    element={
                        canReadActivity ? (
                            <UserActivityPage />
                        ) : (
                            <Navigate to="../overview" replace />
                        )
                    }
                />
                <Route
                    path="preferences"
                    element={
                        isSelf ? (
                            <UserPreferencesPage />
                        ) : (
                            <Navigate to="../overview" replace />
                        )
                    }
                />
                <Route
                    path="general"
                    element={<Navigate to="../overview" replace />}
                />
                <Route
                    path="roles"
                    element={<Navigate to="../overview" replace />}
                />
                <Route
                    path="sessions"
                    element={<Navigate to="../access" replace />}
                />
                <Route path="*" element={<Navigate to="overview" replace />} />
            </Route>
        </Routes>
    );
}
