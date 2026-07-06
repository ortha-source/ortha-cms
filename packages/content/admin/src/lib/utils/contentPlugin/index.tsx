import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_SIDEBAR_SLOT
} from '@ortha-cms/workspaces-admin';
import { FileStack } from 'lucide-react';
import {
    COLLECTION_PARAM,
    CONTENT_READ,
    CONTENT_SEGMENT,
    RECORD_PARAM,
    RECORDS_SEGMENT
} from '../../constants';

const ContentLibraryPage = lazy(() =>
    import('../../pages/ContentLibraryPage').then((module) => ({
        default: module.ContentLibraryPage
    }))
);

const RecordEditPage = lazy(() =>
    import('../../pages/RecordEditPage').then((module) => ({
        default: module.RecordEditPage
    }))
);

/**
 * Admin-side content plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config has a home.
 */
export type ContentAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side Content Library plugin. Its Library lives **strictly
 * inside a workspace**: a rail button (`order: 10`, first) + a route into the
 * workspace shell's slots (owned by `@ortha-cms/workspaces-admin`). Register it
 * after `WorkspacesPlugin()` so those slots exist.
 *
 * It also contributes one **top-level, full-viewport** route — the dynamic
 * record editor (`/records/:collection/:recordId`) — mounted as a `public`
 * sibling so it renders chrome-less, without the workspace sidebar (the editor
 * ships its own top bar + sidebar toggle).
 */
export function ContentPlugin(): ContentAdminPlugin {
    return {
        name: 'content',
        routes: [
            {
                path: `/${RECORDS_SEGMENT}/:${COLLECTION_PARAM}/:${RECORD_PARAM}`,
                public: true,
                element: (
                    <Suspense fallback={null}>
                        <RecordEditPage />
                    </Suspense>
                )
            },
            {
                path: `/${RECORDS_SEGMENT}/:${COLLECTION_PARAM}`,
                public: true,
                element: (
                    <Suspense fallback={null}>
                        <RecordEditPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: WORKSPACE_SIDEBAR_SLOT,
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
