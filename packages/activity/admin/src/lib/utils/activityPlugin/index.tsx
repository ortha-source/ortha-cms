import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { HOME_SECTION_SLOT, SIDEBAR_NAV_SLOT } from '@ortha-cms/shell-admin';
import { Activity } from 'lucide-react';
import { ActivityLogPageSkeleton } from '../../components/ActivityLogSkeleton';
import { RecentActivityPanel } from '../../components/RecentActivityPanel';

// Lazy-loaded so the Activity Log page is code-split into its own chunk,
// fetched only when a signed-in user first navigates to `/activity`.
const ActivityLogPage = lazy(() =>
    import('../../pages/ActivityLogPage').then((module) => ({
        default: module.ActivityLogPage
    }))
);

/**
 * Admin-side activity plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config (a per-user detail tab, slots) has a home.
 */
export type ActivityAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side activity plugin. It owns the audit-log feature: the
 * private `/activity` route (the Activity Log page, rendered inside the
 * shell's authenticated layout) and its toolbar nav entry, contributed to the
 * shell's {@link NAVBAR_START_SLOT} at `order: 35` (after Members). The page
 * itself gates on the `activity:read` permission, so the nav entry is hidden
 * for users who lack it.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [
 *     IdentityPlugin(),
 *     ShellPlugin(),
 *     WorkspacesPlugin(),
 *     UsersPlugin(),
 *     ActivityPlugin(),
 *   ],
 * });
 * ```
 */
export function ActivityPlugin(): ActivityAdminPlugin {
    return {
        name: 'activity',
        routes: [
            {
                path: '/activity',
                element: (
                    <Suspense fallback={<ActivityLogPageSkeleton />}>
                        <ActivityLogPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: SIDEBAR_NAV_SLOT,
                items: [
                    {
                        labelId: 'activity.nav.label',
                        defaultLabel: 'Activity',
                        to: '/activity',
                        group: 'overview',
                        order: 20,
                        icon: Activity,
                        permission: 'activity:read'
                    }
                ]
            },
            {
                // Home dashboard: the recent-activity panel.
                slot: HOME_SECTION_SLOT,
                items: [
                    {
                        id: 'activity.home.recent',
                        region: 'panel',
                        order: 20,
                        Component: RecentActivityPanel
                    }
                ]
            }
        ]
    };
}
