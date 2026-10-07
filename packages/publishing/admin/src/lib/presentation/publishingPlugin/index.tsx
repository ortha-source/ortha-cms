import { lazy, Suspense } from 'react';
import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import { Skeleton } from '@orthacms/design-system';
import {
    ENTRY_MENU_GROUP,
    ENTRY_MENU_SLOT,
    RECORDS_BULK_ACTION_SLOT,
    type EntryMenuItem,
    type RecordsBulkActionItem
} from '@orthacms/content-admin';
import { WORKSPACE_ROUTE_SLOT } from '@orthacms/workspaces-admin';
import { PUBLISH_SEGMENT, SLOT_ITEM_ID } from '../../domain/constants';
import { usePublishSelectionAction } from '../hooks/usePublishSelectionAction';
import { usePublishEntryAction } from '../hooks/usePublishEntryAction';

const PublishManagerPage = lazy(() =>
    import('../pages/PublishManagerPage').then((module) => ({
        default: module.PublishManagerPage
    }))
);

/** The plugin object shape returned by {@link PublishingPlugin}. */
export type PublishingAdminPlugin = AdminPlugin;

/**
 * Creates the publishing admin plugin — the **Publish Manager**, a page for
 * publishing a set of records together with their translations and the drafts
 * they link to.
 *
 * - a workspace route, `publish`, rendering the page (no nav item: the page is
 *   always about a set, and is opened on one — an entry in the sidebar would
 *   lead to an empty page);
 * - **Open in Publish Manager** in the records selection bar's ⋯ menu and in
 *   the entry editor's ⋯ menu.
 *
 * It declares two slots of its own (`PUBLISH_EXPANSION_SLOT`,
 * `PUBLISH_ANNOTATION_SLOT`), filled by `@orthacms/i18n-admin` (translations)
 * and `@orthacms/protection-admin` (approvals), so register it **after**
 * `ContentPlugin()` and `WorkspacesPlugin()`, whose slots it fills. Publishing
 * itself is content's bulk publish, per type — this plugin adds no endpoint.
 */
export function PublishingPlugin(): PublishingAdminPlugin {
    const selectionItem: RecordsBulkActionItem = {
        id: SLOT_ITEM_ID.BulkAction,
        // Beside the built-in Publish it extends, ahead of transfer's Export.
        order: 5,
        useItem: usePublishSelectionAction
    };
    const entryItem: EntryMenuItem = {
        id: SLOT_ITEM_ID.EntryMenu,
        group: ENTRY_MENU_GROUP.Publish,
        order: 30,
        useItem: usePublishEntryAction
    };
    return {
        name: 'publishing',
        slots: [
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: PUBLISH_SEGMENT,
                        // Never the landing page: the highest order of the
                        // workspace routes it sits beside.
                        order: 90,
                        element: (
                            <Suspense
                                fallback={<Skeleton className="m-6 h-64" />}
                            >
                                <PublishManagerPage />
                            </Suspense>
                        )
                    }
                ]
            },
            { slot: RECORDS_BULK_ACTION_SLOT, items: [selectionItem] },
            { slot: ENTRY_MENU_SLOT, items: [entryItem] }
        ]
    };
}
