import { Suspense } from 'react';
import { lazyPage } from '@orthacms/utils-admin';
import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import { SIDEBAR_NAV_SLOT } from '@orthacms/shell-admin';
import { WORKSPACE_NAV_HEADER_ACTION_SLOT } from '@orthacms/workspaces-admin';
import { Inbox } from 'lucide-react';
import { InboxSkeleton } from '../components/InboxSkeleton';
import { InboxHeaderButton } from '../components/InboxHeaderButton';
import { useInboxNavBadge } from '../hooks/useInboxNavBadge';

// Lazy so the page is its own chunk; the badge and the header button are what
// every screen pays for, and both read one small summary.
const InboxPage = lazyPage(() => import('../pages/InboxPage'), 'InboxPage');

/** Admin-side inbox plugin shape — a named alias of {@link AdminPlugin}. */
export type InboxAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side inbox plugin (ADR-0023): the `/inbox` page, its row
 * in the global sidebar's Overview group with the unread count, and its
 * button in the workspace sidebar's header. Registered after the shell and
 * workspaces plugins, whose slots it fills.
 */
export function InboxPlugin(): InboxAdminPlugin {
    return {
        name: 'inbox',
        routes: [
            {
                path: '/inbox',
                element: (
                    <Suspense fallback={<InboxSkeleton />}>
                        <InboxPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: SIDEBAR_NAV_SLOT,
                items: [
                    {
                        labelId: 'inbox.nav.label',
                        defaultLabel: 'Inbox',
                        to: '/inbox',
                        group: 'overview',
                        // Between Home (10) and Activity (20).
                        order: 15,
                        icon: Inbox,
                        iconColor: 'text-nav-violet',
                        useBadge: useInboxNavBadge
                    }
                ]
            },
            {
                slot: WORKSPACE_NAV_HEADER_ACTION_SLOT,
                items: [
                    {
                        id: 'inbox.headerButton',
                        order: 10,
                        Component: InboxHeaderButton
                    }
                ]
            }
        ]
    };
}
