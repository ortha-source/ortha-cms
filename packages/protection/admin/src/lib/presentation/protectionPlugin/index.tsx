import type { AdminPlugin } from '@orthacms/bootstrap-admin';
import {
    ENTRY_HEADER_SLOT,
    ENTRY_PUBLISH_GUARD_SLOT,
    ENTRY_SIDEBAR_WIDGET_SLOT
} from '@orthacms/content-admin';
import { ReviewChip } from '../components/ReviewChip';
import { ReviewSection } from '../components/ReviewSection';
import { usePublishProtectionVerdict } from '../slots/publishGuard';

/** Admin-side protection plugin shape — a named alias of {@link AdminPlugin}. */
export type ProtectionAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side protection plugin.
 *
 * **Three contributions and no routes of its own.** Everything this plugin
 * shows lives inside somebody else's screen — the entry editor — because that
 * is where the requirement is met or missed. It owns no page yet; the reviewer
 * queue and the settings tab are the next PR.
 *
 * Every one of the three renders **nothing** on an unprotected type, so an
 * installation with no rule is byte-for-byte the admin it was before the plugin
 * was installed (`protection:I-04`, the client half).
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
            }
        ]
    };
}
