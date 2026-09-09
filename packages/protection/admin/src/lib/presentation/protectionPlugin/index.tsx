import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import {
    ENTRY_HEADER_SLOT,
    ENTRY_PUBLISH_GUARD_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT
} from '@orthacms/content-admin';
import { WORKSPACE_SETTINGS_TAB_SLOT } from '@orthacms/workspaces-admin';
import { Shield } from 'lucide-react';
import { ProtectionSettings } from '../components/ProtectionSettings';
import { ReviewChip } from '../components/ReviewChip';
import { ReviewSection } from '../components/ReviewSection';
import { usePublishProtectionVerdict } from '../slots/publishGuard';

/** Admin-side protection plugin shape — a named alias of {@link AdminPlugin}. */
export type ProtectionAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side protection plugin.
 *
 * **Four contributions and no routes of its own.** Everything this plugin
 * shows lives inside somebody else's screen — three in the entry editor, where
 * the requirement is met or missed, and one in workspace settings, where a rule
 * is made. The reviewer queue is the next PR.
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
