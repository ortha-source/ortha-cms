import { scopePermissions, tokenActor } from './api-token-scope';

describe('scopePermissions', () => {
    it('grants reading content and its media for a read token', () => {
        // `media:read` rides along because the public content reads hand back a
        // media field's assets as metadata plus a URL — withholding the bytes
        // from the token that just received the URL makes the metadata useless.
        expect(scopePermissions('read')).toEqual([
            'content:read',
            'media:read',
            // Reader entitlements decide which published entries a request sees
            // at all, so a token that cannot ask whether an entry is restricted
            // reports a partial list as the whole one. It reveals nothing new
            // about the content: the only entries whose access it can look up
            // are the ones it can already fetch.
            'segments:read'
        ]);
    });

    it('grants the full content CRUD set plus uploads for a full token', () => {
        expect(scopePermissions('full')).toEqual([
            'content:read',
            'content:create',
            'content:update',
            'content:publish',
            'content:delete',
            'media:read',
            'media:create',
            'segments:read',
            // Setting who may read a record is an entry-level editorial
            // decision of the same weight as publishing or deleting it. What it
            // does not open is the audience *vocabulary* — no token-facing
            // surface exposes the directory, so this key reaches entry access
            // and nothing else.
            'segments:manage'
        ]);
    });

    it('never lets a read token write', () => {
        const read = new Set(scopePermissions('read'));
        expect(read.has('content:create')).toBe(false);
        expect(read.has('content:update')).toBe(false);
        expect(read.has('content:publish')).toBe(false);
        expect(read.has('content:delete')).toBe(false);
        // Including uploads: a read token can fetch an asset, never add one.
        expect(read.has('media:create')).toBe(false);
        // …and never decides who may read one.
        expect(read.has('segments:manage')).toBe(false);
    });

    /**
     * An approval is not a database write, it is a person's statement that they
     * looked. ADR-0017 §6 withholds an `approve` tool from every agent surface
     * for that reason — and that refusal buys nothing if the same act can be
     * performed by minting a key, which is anonymous by construction: a token
     * has no `users` row, so a vote from one would satisfy the count while
     * naming nobody in the log and nobody in the four-eyes check.
     *
     * `full` already carries `content:publish`, so adding `content:approve`
     * beside it "for symmetry" is the obvious future mistake. This is the test
     * that stops it, and the reason lives next to the assertion rather than
     * only in a design document.
     */
    it('never lets any token approve content [protection:I-12]', () => {
        for (const scope of ['read', 'full'] as const) {
            expect(
                new Set(scopePermissions(scope)).has('content:approve')
            ).toBe(false);
        }
    });

    it('never lets any token curate the media library [media:I-26]', () => {
        // Attaching an asset to a record is content authoring; renaming or
        // deleting somebody else's library asset is administration, and nothing
        // on the public API needs it.
        for (const scope of ['read', 'full'] as const) {
            const granted = new Set(scopePermissions(scope));
            expect(granted.has('media:update')).toBe(false);
            expect(granted.has('media:delete')).toBe(false);
        }
    });
});

/**
 * The bridge between a verified token and an access decision. Two invariants
 * live here and nowhere else: *who* the decision is made for, and *what* that
 * actor is allowed to hold.
 */
describe('tokenActor', () => {
    /** A verified token, plus the minting user the actor must never become. */
    const verified = {
        id: 'token-1',
        scope: 'read' as const,
        // Not part of `ScopedToken` — carried here to make the point explicit:
        // even when the caller has the minting user at hand, the actor is the
        // token.
        createdBy: 'user-1'
    };

    it('identifies the actor by the token, never by the minting user [api-tokens:I-16]', () => {
        // Revoking a token has to be enough to revoke its access. If the actor
        // were the minting user, an access decision would follow that user's
        // role instead — so a revoked token would keep working for as long as
        // its creator kept their grants, and a promoted creator would silently
        // widen every token they ever minted.
        expect(tokenActor(verified).userId).toBe('token-1');
        expect(tokenActor(verified).userId).not.toBe(verified.createdBy);
    });

    it('grants exactly what the scope maps to, for both scopes', () => {
        for (const scope of ['read', 'full'] as const) {
            const granted = tokenActor({
                id: 'token-1',
                scope
            }).grantedPermissions;
            // Set equality both ways: a superset would be an escalation, a
            // subset would silently break a documented scope.
            expect([...granted].sort()).toEqual(
                [...scopePermissions(scope)].sort()
            );
            expect(granted.size).toBe(scopePermissions(scope).length);
        }
    });

    it('never lets a token mint, read or revoke another token', () => {
        // The escalation this whole design exists to prevent. A token that
        // holds `tokens:create` can mint a `full` token and hand it on, so a
        // read-only credential leaked into a build log becomes a permanent
        // write credential nobody minted. The management routes are
        // session-guarded precisely so this stays impossible — and this is the
        // assertion that fails if a future scope quietly adds the key.
        for (const scope of ['read', 'full'] as const) {
            const granted = tokenActor({
                id: 'token-1',
                scope
            }).grantedPermissions;
            expect(granted.has('tokens:read')).toBe(false);
            expect(granted.has('tokens:create')).toBe(false);
            expect(granted.has('tokens:delete')).toBe(false);
        }
    });
});
