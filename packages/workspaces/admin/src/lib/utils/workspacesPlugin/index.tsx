import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { NAVBAR_START_SLOT } from '@ortha-cms/shell-admin';
import { Layers } from 'lucide-react';
import {
    CreateWorkspacePageSkeleton,
    WorkspacesPageSkeleton
} from '../../components/WorkspacesSkeleton';

// Lazy-loaded so each page is code-split into its own chunk, fetched only when
// a signed-in user first navigates to it.
const WorkspacesPage = lazy(() =>
    import('../../pages/WorkspacesPage').then((module) => ({
        default: module.WorkspacesPage
    }))
);

const CreateWorkspacePage = lazy(() =>
    import('../../pages/CreateWorkspacePage').then((module) => ({
        default: module.CreateWorkspacePage
    }))
);

/**
 * Admin-side workspaces plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config (sub-routes, slots) has a home.
 */
export type WorkspacesAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side workspaces plugin. It owns the workspaces feature: the
 * private `/workspaces` route (rendered inside the shell's authenticated
 * layout) and its toolbar nav entry, contributed to the shell's
 * {@link NAVBAR_START_SLOT} at `order: 20` (before Users). This replaces the
 * placeholder the shell shipped while the feature was pending.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [
 *     IdentityPlugin(),
 *     ShellPlugin(),
 *     WorkspacesPlugin(),
 *   ],
 * });
 * ```
 */
export function WorkspacesPlugin(): WorkspacesAdminPlugin {
    return {
        name: 'workspaces',
        routes: [
            {
                path: '/workspaces',
                element: (
                    <Suspense fallback={<WorkspacesPageSkeleton />}>
                        <WorkspacesPage />
                    </Suspense>
                )
            },
            {
                path: '/workspaces/new',
                element: (
                    <Suspense fallback={<CreateWorkspacePageSkeleton />}>
                        <CreateWorkspacePage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: NAVBAR_START_SLOT,
                items: [
                    {
                        labelId: 'workspaces.nav.label',
                        defaultLabel: 'Workspaces',
                        to: '/workspaces',
                        order: 20,
                        icon: Layers
                    }
                ]
            }
        ]
    };
}
