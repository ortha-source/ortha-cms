import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import {
    ENTRY_HEADER_SLOT,
    ENTRY_PUBLISH_GUARD_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT
} from '@orthacms/content-admin';
import {
    WORKSPACE_NAV_SLOT,
    WORKSPACE_ROUTE_SLOT,
    WORKSPACE_SETTINGS_TAB_SLOT
} from '@orthacms/workspaces-admin';
import { Shield, ShieldCheck } from 'lucide-react';
import { ProtectionSettings } from '../components/ProtectionSettings';
import { ReviewsSkeleton } from '../components/ReviewsSkeleton';
import { ReviewChip } from '../components/ReviewChip';
import { ReviewSection } from '../components/ReviewSection';
import { usePublishProtectionVerdict } from '../slots/publishGuard';

// Lazy so the Reviews page is its own chunk, fetched when somebody first opens
// it — every other surface this plugin has is a slot contribution that rides
// screens the person was already on.
const ReviewsPage = lazy(() =>
    import('../pages/ReviewsPage').then((module) => ({
        default: module.ReviewsPage
    }))
);

/** Admin-side protection plugin shape — a named alias of {@link AdminPlugin}. */
export type ProtectionAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side protection plugin.
 *
 * **Five contributions and one route of its own.** Almost everything this plugin
 * shows lives inside somebody else's screen — three in the entry editor, where
 * the requirement is met or missed, and one in workspace settings, where a rule
 * is made. The Reviews page is the exception, and it has to be: an ask arrives
 * against whichever type someone happened to be editing, so no single
 * collection's list can be where a reviewer looks for it.
 *
 * The three entry contributions render **nothing** on an unprotected type, so
 * an installation with no rule is byte-for-byte the admin it was before the
 * plugin was installed (`protection:I-04`, the client half). The settings tab
 * is the exception on purpose: it is where a workspace with no rule goes to get
 * one, so it has to be visible before there is anything to see.
 */
export function ProtectionPlugin(): ProtectionAdminPlugin {
    return {
        name: 'protection',
        slots: [
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: 'reviews',
                        // After the content library and alarms: somebody
                        // landing on a workspace wants their content, not
                        // their queue.
                        order: 50,
                        element: (
                            <Suspense fallback={<ReviewsSkeleton />}>
                                <ReviewsPage />
                            </Suspense>
                        )
                    }
                ]
            },
            {
                slot: WORKSPACE_NAV_SLOT,
                items: [
                    {
                        labelId: 'protection.nav.reviews',
                        defaultLabel: 'Reviews',
                        to: 'reviews',
                        order: 50,
                        icon: ShieldCheck,
                        // `content:read`, not `content:approve`: the "My
                        // requests" tab is an author checking on work they
                        // sent, and somebody who cannot approve still has to
                        // see whether anyone has looked.
                        permission: 'content:read'
                    }
                ]
            },
            {
                slot: ENTRY_HEADER_SLOT,
                items: [{ id: 'protection.review', Component: ReviewChip }]
            },
            {
                slot: ENTRY_SIDEBAR_WIDGET_SLOT,
                items: [{ id: 'protection.review', Component: ReviewSection }]
            },
            {
                slot: ENTRY_PUBLISH_GUARD_SLOT,
                items: [
                    {
                        id: 'protection.approvals',
                        useVerdict: usePublishProtectionVerdict
                    }
                ]
            },
            {
                slot: WORKSPACE_SETTINGS_TAB_SLOT,
                items: [
                    {
                        id: 'protection',
                        path: 'protection',
                        labelId: 'protection.settings.tab',
                        defaultLabel: 'Protection',
                        icon: Shield,
                        order: 10,
                        // Administrator-only, and so is the list route it
                        // opens — a member without it is shown no link rather
                        // than a tab that answers 403.
                        permission: 'protection:manage',
                        element: <ProtectionSettings />
                    }
                ]
            }
        ]
    };
}
