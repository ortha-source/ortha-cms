import { isOfferedIn } from './segment';

describe('isOfferedIn', () => {
    const anywhere = { id: 's1', key: 'acme', label: 'Acme', tags: ['acme'] };
    const scoped = { ...anywhere, workspaceIds: ['w1', 'w2'] };

    it('offers an unscoped audience everywhere', () => {
        // The state every segment starts in, and the reason emptiness reads as
        // "all" rather than "none": the opposite would make every existing
        // audience vanish from every editor the day the column shipped.
        expect(isOfferedIn(anywhere, 'w9')).toBe(true);
        expect(isOfferedIn({ ...anywhere, workspaceIds: [] }, 'w9')).toBe(true);
    });

    it('offers a scoped audience only where it is named', () => {
        expect(isOfferedIn(scoped, 'w1')).toBe(true);
        expect(isOfferedIn(scoped, 'w3')).toBe(false);
    });

    it('refuses a scoped audience when no workspace is known', () => {
        // Fail closed: a caller that cannot say where it is cannot be shown to
        // be somewhere the audience was offered.
        expect(isOfferedIn(scoped, undefined)).toBe(false);
        expect(isOfferedIn(anywhere, undefined)).toBe(true);
    });
});
