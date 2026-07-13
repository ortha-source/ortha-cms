import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_NAV_SLOT
} from '@ortha-cms/workspaces-admin';
import { BarChart3 } from 'lucide-react';

const InsightsPage = lazy(() =>
    import('../../pages/InsightsPage').then((module) => ({
        default: module.InsightsPage
    }))
);

/**
 * Admin-side insights plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config has a home.
 */
export type InsightsAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side Insights plugin. It lives **strictly inside a
 * workspace**: it contributes no top-level route and no top-toolbar nav entry,
 * only a rail button (`order: 30`) + a route to the workspace shell's slots
 * (owned by `@ortha-cms/workspaces-admin`). Register it after
 * `WorkspacesPlugin()` so those slots exist.
 */
export function InsightsPlugin(): InsightsAdminPlugin {
    return {
        name: 'insights',
        slots: [
            {
                slot: WORKSPACE_NAV_SLOT,
                items: [
                    {
                        labelId: 'insights.nav.label',
                        defaultLabel: 'Insights',
                        to: 'insights',
                        order: 30,
                        icon: BarChart3
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: 'insights/*',
                        element: (
                            <Suspense fallback={null}>
                                <InsightsPage />
                            </Suspense>
                        )
                    }
                ]
            }
        ]
    };
}
