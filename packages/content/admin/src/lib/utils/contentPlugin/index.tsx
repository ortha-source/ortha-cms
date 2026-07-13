import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import {
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_SECTION_SLOT
} from '@ortha-cms/workspaces-admin';
import { CONTENT_SEGMENT } from '../../constants';
import { ContentNavSection } from '../../components/ContentNavSection';

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
 * only the **Content** section of the workspace sidebar (the content-type nav +
 * ⌘K search, `WORKSPACE_SECTION_SLOT`) + its `content/*` route (the
 * lowest-order route, so the workspace base lands here). Both go into the
 * workspace shell's slots (owned by `@ortha-cms/workspaces-admin`), so register
 * it after `WorkspacesPlugin()`.
 */
export function ContentPlugin(): ContentAdminPlugin {
    return {
        name: 'content',
        slots: [
            {
                slot: WORKSPACE_SECTION_SLOT,
                items: [
                    {
                        id: 'content.nav',
                        order: 10,
                        Component: ContentNavSection
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: `${CONTENT_SEGMENT}/*`,
                        // Lowest order → the workspace's default landing section.
                        order: 10,
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
