import { createSlot } from '@orthacms/utils-admin';

/**
 * One plugin's reaction to the identity behind this tab changing — what it
 * holds for the outgoing session, dropped.
 *
 * `resetSessionCache` sweeps the query cache, and for most plugins that is the
 * whole of what a session accumulates. It is not for a plugin that keeps state
 * **outside** TanStack Query on purpose: the copilot's chats live in module
 * state so a run outlives the component showing it, which is exactly why they
 * also outlived the account that started them — the next person to sign in on
 * the tab inherited the dock, and a run still streaming kept going.
 */
export type SessionResetItem = {
    /** Unique id; the contributing plugin's name is enough. */
    id: string;
    /**
     * Drops everything this plugin holds for the session that just ended, and
     * cancels anything it still has in flight on that session's behalf.
     *
     * Synchronous and **idempotent**: it runs on every change of identity —
     * signing out, signing in, accepting an invite, a session lost to a `401` —
     * and more than one of those can describe the same change.
     */
    reset(): void;
};

/**
 * Where a plugin registers its {@link SessionResetItem}.
 *
 * A slot rather than an import in either direction: identity must not know
 * which plugins hold session state, and a plugin that does already depends on
 * identity (for `useHasPermission`), so contributing here costs it nothing new.
 * Read with a plain `getItems()`, not a hook — it is consulted from mutation
 * callbacks and effects, and its contents are fixed at boot.
 */
export const SESSION_RESET_SLOT = createSlot<SessionResetItem>(
    'identity.session.reset'
);

/**
 * Runs every registered {@link SessionResetItem}.
 *
 * Each runs on its own: one plugin's reset throwing must not leave the next
 * plugin's state for the incoming account, so a failure is logged and the walk
 * continues.
 */
export function runSessionResets(): void {
    for (const item of SESSION_RESET_SLOT.getItems()) {
        try {
            item.reset();
        } catch (error) {
            console.error(
                `The "${item.id}" session reset threw; the others still ran.`,
                error
            );
        }
    }
}
