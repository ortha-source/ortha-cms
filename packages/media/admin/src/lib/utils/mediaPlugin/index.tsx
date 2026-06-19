import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_SIDEBAR_SLOT
} from '@ortha-cms/workspaces-admin';
import { Image } from 'lucide-react';

const MediaLibraryPage = lazy(() =>
    import('../../pages/MediaLibraryPage').then((module) => ({
        default: module.MediaLibraryPage
    }))
);

/**
 * Admin-side media plugin shape. A thin alias of {@link AdminPlugin}, kept named
 * so future config has a home.
 */
export type MediaAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side Media Library plugin. It lives **strictly inside a
 * workspace**: it contributes no top-level route and no top-toolbar nav entry,
 * only a rail button (`order: 20`) + a route to the workspace shell's slots
 * (owned by `@ortha-cms/workspaces-admin`). Register it after
 * `WorkspacesPlugin()` so those slots exist.
 */
export function MediaPlugin(): MediaAdminPlugin {
    return {
        name: 'media',
        slots: [
            {
                slot: WORKSPACE_SIDEBAR_SLOT,
                items: [
                    {
                        labelId: 'media.nav.label',
                        defaultLabel: 'Media Library',
                        to: 'media',
                        order: 20,
                        icon: Image
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: 'media/*',
                        element: (
                            <Suspense fallback={null}>
                                <MediaLibraryPage />
                            </Suspense>
                        )
                    }
                ]
            }
        ]
    };
}
