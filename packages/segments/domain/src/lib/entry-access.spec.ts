import { canRead, isOpen, OPEN_ACCESS } from './entry-access';

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
    it('reads an empty allow list as everyone, not as nobody', () => {
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
    it('refuses a denied reader even when they are also allowed', () => {
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
