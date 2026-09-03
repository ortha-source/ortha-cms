import { canRead, isOpen, sameAccess, OPEN_ACCESS } from './entry-access';

/** A reader carrying the given segments. */
const reader = (...ids: string[]) => new Set(ids);

describe('canRead', () => {
    it('lets everyone in when nothing is set', () => {
        expect(canRead(OPEN_ACCESS, reader())).toBe(true);
        expect(canRead(OPEN_ACCESS, reader('acme'))).toBe(true);
    });

    /**
     * The one asymmetry worth pinning: an empty allow list means *everyone*,
     * not nobody. Read the other way, switching the feature on would black out
     * every entry in the library.
     */
    it('reads an empty allow list as everyone, not as nobody [segments:I-03]', () => {
        expect(canRead({ allow: [], deny: ['globex'] }, reader())).toBe(true);
        expect(canRead({ allow: [], deny: ['globex'] }, reader('acme'))).toBe(
            true
        );
    });

    it('admits only the named segments once an allow list exists', () => {
        const access = { allow: ['acme'], deny: [] };
        expect(canRead(access, reader('acme'))).toBe(true);
        expect(canRead(access, reader('globex'))).toBe(false);
        // The anonymous reader is in no segment, so an allow list shuts them out.
        expect(canRead(access, reader())).toBe(false);
    });

    it('lets a reader in through any one of several allowed segments', () => {
        const access = { allow: ['acme', 'globex'], deny: [] };
        expect(canRead(access, reader('globex'))).toBe(true);
    });

    /** A deny beats an allow — that is what makes "all except one" sayable. */
    it('refuses a denied reader even when they are also allowed [segments:I-04]', () => {
        const access = { allow: ['acme', 'globex'], deny: ['globex'] };
        expect(canRead(access, reader('acme'))).toBe(true);
        expect(canRead(access, reader('globex'))).toBe(false);
        expect(canRead(access, reader('acme', 'globex'))).toBe(false);
    });

    it('expresses “everyone except one” with a single deny', () => {
        const access = { allow: [], deny: ['globex'] };
        expect(canRead(access, reader('acme'))).toBe(true);
        expect(canRead(access, reader('trial'))).toBe(true);
        expect(canRead(access, reader('globex'))).toBe(false);
    });
});

describe('isOpen', () => {
    it('is true only when neither list holds anything', () => {
        expect(isOpen(OPEN_ACCESS)).toBe(true);
        expect(isOpen({ allow: ['acme'], deny: [] })).toBe(false);
        expect(isOpen({ allow: [], deny: ['globex'] })).toBe(false);
    });
});

/**
 * Whether two sets of lists say the same thing.
 *
 * Load-bearing in three places, and in one of them it decides whether a
 * **permission check runs at all**: the entry-write extension skips the write
 * — and `assertMayManage` with it — when a save asks for what is already
 * stored. That is what keeps a restore working for anyone who may restore. Read
 * too loosely it would wave through a real change; read too strictly it would
 * demand `segments:manage` to restore an entry's words.
 */
describe('sameAccess', () => {
    it('ignores the order of either list', () => {
        // The lists are sets everywhere they matter, and the stored arrays come
        // back in insertion order — so a caller resending the same audiences in
        // a different order is asking for no change at all.
        expect(
            sameAccess(
                { allow: ['acme', 'globex'], deny: [] },
                { allow: ['globex', 'acme'], deny: [] }
            )
        ).toBe(true);
        expect(
            sameAccess(
                { allow: [], deny: ['acme', 'globex'] },
                { allow: [], deny: ['globex', 'acme'] }
            )
        ).toBe(true);
    });

    it('compares both sides, not just the allow list', () => {
        expect(
            sameAccess(
                { allow: ['acme'], deny: ['globex'] },
                { allow: ['acme'], deny: [] }
            )
        ).toBe(false);
    });

    it('does not confuse the two sides with each other', () => {
        // "Only Acme may read it" and "everyone except Acme" are opposite
        // decisions built from the same one id.
        expect(
            sameAccess(
                { allow: ['acme'], deny: [] },
                { allow: [], deny: ['acme'] }
            )
        ).toBe(false);
    });

    it('sees an added or removed audience', () => {
        expect(
            sameAccess(
                { allow: ['acme'], deny: [] },
                { allow: ['acme', 'globex'], deny: [] }
            )
        ).toBe(false);
    });

    it('reads two open entries as the same', () => {
        // The common case on the write path: a save that never mentioned access
        // still arrives here, and must not be turned into a decision.
        expect(sameAccess(OPEN_ACCESS, { allow: [], deny: [] })).toBe(true);
    });

    it('does not read an open entry as a restricted one', () => {
        expect(sameAccess(OPEN_ACCESS, { allow: ['acme'], deny: [] })).toBe(
            false
        );
    });
});
