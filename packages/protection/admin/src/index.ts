/**
 * Public API of `@orthacms/protection-admin` — publication protection as the
 * person editing an entry meets it.
 *
 * Three contributions into the Content Library's slots and no page of its own:
 * a chip beside the title, a Review block in the properties rail, and the
 * verdict that decides what the Publish button says. Every one of them is
 * silent on a type nobody protected.
 */

export { ProtectionPlugin } from './lib/presentation/protectionPlugin';
export type { ProtectionAdminPlugin } from './lib/presentation/protectionPlugin';

// The review read, exported for the surfaces the next PR adds (the reviewer
// queue and the records column) so they read the same endpoint through the same
// cache rather than a second copy of it.
export { useEntryReview, reviewScopeOf } from './lib/application/hooks';
export type { EntryReviewScope } from './lib/application/hooks';
export type {
    EntryReview,
    ReviewApproval,
    ReviewRequest,
    ReviewTone
} from './lib/domain/types';
export { toneOf } from './lib/domain/types';
