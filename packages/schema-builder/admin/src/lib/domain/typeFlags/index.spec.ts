import { typeDoc } from '../../../testing/document';
import { canChangeFlag } from './index';

describe('canChangeFlag', () => {
    it('lets a new type set every flag', () => {
        const fresh = typeDoc({ name: 't', origin: 'new' });
        expect(
            ['publishable', 'paranoid', 'i18n'].every((flag) =>
                canChangeFlag(fresh, flag as never)
            )
        ).toBe(true);
    });

    it('lets an existing type only turn the trash on', () => {
        const live = typeDoc({ name: 't', origin: 'builder' });
        expect(canChangeFlag(live, 'paranoid')).toBe(true);
        expect(canChangeFlag({ ...live, paranoid: true }, 'paranoid')).toBe(
            false
        );
        expect(canChangeFlag(live, 'publishable')).toBe(false);
        expect(canChangeFlag(live, 'i18n')).toBe(false);
    });
});
