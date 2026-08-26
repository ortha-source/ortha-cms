import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import { SIDEBAR_NAV_SLOT } from '@orthacms/shell-admin';
import {
    WORKSPACE_NAV_SLOT,
    WORKSPACE_ROUTE_SLOT
} from '@orthacms/workspaces-admin';
import {
    ENTRY_HEADER_SLOT,
    ENTRY_TAB,
    ENTRY_TAB_SLOT
} from '@orthacms/content-admin';
import { ShieldCheck } from 'lucide-react';
import {
    SegmentTypesPageSkeleton,
    WorkspaceAccessPageSkeleton
} from '../components/AccessSkeleton';
import { EntryAccessChip } from '../components/EntryAccessChip';
import { EntryAccessTab } from '../components/EntryAccessTab';

// Lazy so each page is code-split into its own chunk, fetched only when someone
// first navigates to it. The entry chip and tab are **not** lazy: they mount
// inside the editor, which is already a chunk of its own, and a suspense
// boundary around a badge in the title row is a flicker on every entry open.
const SegmentTypesPage = lazy(() =>
    import('../pages/SegmentTypesPage').then((module) => ({
        default: module.SegmentTypesPage
    }))
);

const WorkspaceAccessPage = lazy(() =>
    import('../pages/WorkspaceAccessPage').then((module) => ({
        default: module.WorkspaceAccessPage
    }))
);

/** Admin-side segmentation plugin shape — a named alias of {@link AdminPlugin}. */
export type SegmentsAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side segmentation plugin.
 *
 * It contributes at **two scopes**, because the model has two. The catalogue —
 * segment types and their segments — is installation-wide, like a content type,
 * so it gets a top-level `/access` route in the global sidebar's directory
 * group. Rules and where they apply are workspace-owned, so they get a
 * workspace route and a "Workspace" nav entry. Collapsing the two into one page
 * would mean either a workspace editing an installation-wide axis or an
 * administrator hunting for a workspace to reach the axes.
 *
 * The third contribution is the one editors actually meet: a chip in the entry
 * editor's title row, and the **Access** tab behind it. The tab's slug is
 * content-admin's own `access` route — a contributed tab must name a slug the
 * router knows, or it renders a tab that cannot be opened.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [
 *     IdentityPlugin(),
 *     ShellPlugin(),
 *     WorkspacesPlugin(),
 *     ContentPlugin(),
 *     SegmentsPlugin(),
 *   ],
 * });
 * ```
 */
export function SegmentsPlugin(): SegmentsAdminPlugin {
    return {
        name: 'segments',
        routes: [
            {
                path: '/access',
                element: (
                    <Suspense fallback={<SegmentTypesPageSkeleton />}>
                        <SegmentTypesPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: SIDEBAR_NAV_SLOT,
                items: [
                    {
                        labelId: 'segments.nav.label',
                        defaultLabel: 'Segmentation',
                        to: '/access',
                        group: 'directory',
                        order: 40,
                        icon: ShieldCheck,
                        iconColor: 'text-nav-purple',
                        // Without this the row is a dead link for anyone who
                        // can't read the catalogue: the page renders its
                        // no-access state, so the nav promises a destination it
                        // won't deliver.
                        permission: 'access:read'
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: 'access',
                        element: (
                            <Suspense
                                fallback={<WorkspaceAccessPageSkeleton />}
                            >
                                <WorkspaceAccessPage />
                            </Suspense>
                        ),
                        // Deliberately not the lowest order: landing on a
                        // workspace should open its content, not its access
                        // rules.
                        order: 60
                    }
                ]
            },
            {
                slot: WORKSPACE_NAV_SLOT,
                items: [
                    {
                        labelId: 'segments.workspaceNav.label',
                        defaultLabel: 'Access',
                        to: 'access',
                        order: 60,
                        icon: ShieldCheck,
                        iconColor: 'text-nav-purple',
                        permission: 'access:read'
                    }
                ]
            },
            {
                slot: ENTRY_HEADER_SLOT,
                items: [
                    {
                        id: 'segments.entry.chip',
                        Component: EntryAccessChip
                    }
                ]
            },
            {
                slot: ENTRY_TAB_SLOT,
                items: [
                    {
                        id: 'segments.entry.tab',
                        slug: ENTRY_TAB.Access,
                        label: {
                            id: 'segments.entryTab.label',
                            defaultMessage: 'Access'
                        },
                        order: 20,
                        // Every type, unlike the Media tab: any entry can be
                        // restricted, and a schema says nothing about whether
                        // it should be. The tab renders its own "nothing is
                        // segmented" state when no axis exists.
                        appliesTo: () => true,
                        Component: EntryAccessTab
                    }
                ]
            }
        ]
    };
}
