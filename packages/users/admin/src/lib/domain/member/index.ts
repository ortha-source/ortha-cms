import type { Member } from '../types/member';

/**
 * Why a guarded member action is currently vetoed, as a machine key the
 * presentation maps to a localized reason:
 * - `self` — you can't disable/suspend your own account, or change your own role.
 * - `lastAdmin` — the sole active admin can't be demoted or disabled.
 * - `customRole` — the member holds a role outside the three assignable system
 *   roles, so the picker cannot represent (or safely replace) it.
 */
export type MemberBlockReason = 'self' | 'lastAdmin' | 'customRole';

/**
 * The result of a UX-invariant check: `ok` when the action is allowed, else the
 * machine `reason` the button/menu shows (disabled, with a tooltip/alert). The
 * server enforces the same rules — this only mirrors them so the control can
 * explain itself before the request instead of failing on submit.
 */
export type MemberInvariant =
    | { ok: true; reason: null }
    | { ok: false; reason: MemberBlockReason };

const ALLOWED: MemberInvariant = { ok: true, reason: null };

/**
 * A member wrapped as a thin client entity, exposing the **UX invariants** the
 * admin mirrors from server-computed facts (`isLastAdmin`, the viewer's id).
 * The admin stays thin — the server owns business truth (ADR-0003); this only
 * lets a control disable itself with a reason rather than let the user click
 * into a guaranteed `409`.
 *
 * It wraps the plain {@link Member} view model (the cached, query-serializable
 * shape) rather than replacing it, so React Query's structural sharing keeps
 * working; construct one on demand where an invariant is needed.
 */
export class MemberEntity {
    private constructor(private readonly member: Member) {}

    /** Wraps a {@link Member} view model for invariant checks. */
    static of(member: Member): MemberEntity {
        return new MemberEntity(member);
    }

    /**
     * Whether this member's global role may be changed by the viewer. Three
     * ways it can't: it's **your own** account (the server 409s "You cannot
     * change your own role"), they are the sole active admin (`isLastAdmin` —
     * demoting them would leave the system with no administrator), or they hold
     * a **custom** role the three-way picker can't represent (`role: null`).
     *
     * `viewerId` is required for the self check, mirroring
     * {@link MemberEntity.canBeRemoved}. Without it the control cannot explain
     * itself and the user is left to discover the rule from a failed request.
     */
    canChangeRole(viewerId: string | undefined): MemberInvariant {
        if (viewerId !== undefined && viewerId === this.member.id) {
            return { ok: false, reason: 'self' };
        }
        if (this.member.isLastAdmin) {
            return { ok: false, reason: 'lastAdmin' };
        }
        if (this.member.role === null) {
            return { ok: false, reason: 'customRole' };
        }
        return ALLOWED;
    }

    /**
     * Whether this member's sign-in access may be removed (disabled/suspended)
     * by the viewer. You can't disable your own account (`self`), and the sole
     * active admin can't be disabled (`lastAdmin`). Enabling/reactivating a
     * disabled member is never vetoed, so callers apply this only to the
     * suspend direction.
     */
    canBeRemoved(viewerId: string | undefined): MemberInvariant {
        if (viewerId !== undefined && viewerId === this.member.id) {
            return { ok: false, reason: 'self' };
        }
        if (this.member.isLastAdmin) {
            return { ok: false, reason: 'lastAdmin' };
        }
        return ALLOWED;
    }
}
