import { typeDoc } from '../../../testing/document';
import { typeEditability } from './index';

describe('typeEditability', () => {
    const editable = { editable: true, restart: 'watch' } as const;
    const owned = typeDoc({ name: 't', origin: 'builder' });

    it('is ok for a builder-owned type, with the permission, on a server that edits', () => {
        expect(typeEditability(owned, editable, true)).toEqual({ ok: true });
    });

    it('says why not — permission first, then the server, then the file', () => {
        expect(typeEditability(owned, editable, false)).toEqual({
            ok: false,
            reason: 'no-permission'
        });
        expect(
            typeEditability(
                owned,
                { editable: false, reason: 'production', restart: 'watch' },
                true
            )
        ).toEqual({
            ok: false,
            reason: 'read-only-server'
        });
        expect(
            typeEditability({ ...owned, origin: 'code' }, editable, true)
        ).toEqual({ ok: false, reason: 'hand-written' });
    });
});
