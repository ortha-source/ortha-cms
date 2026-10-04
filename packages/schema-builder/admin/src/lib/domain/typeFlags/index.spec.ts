import { typeDoc } from '../../../testing/document';
import { canChangeFlag } from './index';

describe('canChangeFlag', () => {
    it('lets a new type set every flag', () => {
        const fresh = typeDoc({ name: 't', origin: 'new' });
        expect(
            ['publishable', 'paranoid', 'i18n'].every((flag) =>
                canChangeFlag(fresh, flag as never, undefined)
            )
        ).toBe(true);
        // Switched on, and off again: nothing about a new type is fixed yet.
        expect(
            canChangeFlag({ ...fresh, paranoid: true }, 'paranoid', undefined)
        ).toBe(true);
    });

    it('lets an existing type only turn the trash on', () => {
        const live = typeDoc({ name: 't', origin: 'builder' });
        expect(canChangeFlag(live, 'paranoid', live)).toBe(true);
        const trashed = { ...live, paranoid: true };
        expect(canChangeFlag(trashed, 'paranoid', trashed)).toBe(false);
        expect(canChangeFlag(live, 'publishable', live)).toBe(false);
        expect(canChangeFlag(live, 'i18n', live)).toBe(false);
    });

    it('lets the draft take back a flag it changed, until it is applied', () => {
        const live = typeDoc({ name: 't', origin: 'builder' });
        // Trash switched on in the draft: it can still go off again.
        expect(
            canChangeFlag({ ...live, paranoid: true }, 'paranoid', live)
        ).toBe(true);
    });
});
