import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_NAV_SLOT
} from '@ortha-cms/workspaces-admin';
import { FileStack } from 'lucide-react';
import { CONTENT_READ, CONTENT_SEGMENT } from '../../constants';

const ContentLibraryPage = lazy(() =>
    import('../../pages/ContentLibraryPage').then((module) => ({
        default: module.ContentLibraryPage
    }))
);

/**
 * Admin-side content plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config has a home.
 */
export type ContentAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side Content Library plugin. It lives **strictly inside a
 * workspace**: it contributes no top-level route and no top-toolbar nav entry,
 * only a rail button (`order: 10`, first) + a route to the workspace shell's
 * slots (owned by `@ortha-cms/workspaces-admin`). Register it after
 * `WorkspacesPlugin()` so those slots exist.
 */
export function ContentPlugin(): ContentAdminPlugin {
    return {
        name: 'content',
        slots: [
            {
                slot: WORKSPACE_NAV_SLOT,
                items: [
                    {
                        labelId: 'content.nav.label',
                        defaultLabel: 'Content Library',
                        to: CONTENT_SEGMENT,
                        order: 10,
                        icon: FileStack,
                        permission: CONTENT_READ
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: `${CONTENT_SEGMENT}/*`,
                        element: (
                            <Suspense fallback={null}>
                                <ContentLibraryPage />
                            </Suspense>
                        )
                    }
                ]
            }
        ]
    };
}
