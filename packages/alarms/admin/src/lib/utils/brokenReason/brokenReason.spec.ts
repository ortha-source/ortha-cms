import { brokenFieldOf } from './index';

/** Turning the engine's message into the field a person has to fix. */
describe('brokenFieldOf [alarms:I-08]', () => {
    it('reads the field out of an unknown-field reason', () => {
        expect(brokenFieldOf('unknown field "category"')).toBe('category');
        expect(brokenFieldOf('unknown field "author.status"')).toBe(
            'author.status'
        );
    });

    it('reads the relation out of an unknown-relation reason', () => {
        expect(
            brokenFieldOf('unknown relation "author" in "author.status"')
        ).toBe('author');
    });

    it('declines anything else, so the card shows the raw reason', () => {
        expect(brokenFieldOf('unknown operator "nearly"')).toBeNull();
        expect(brokenFieldOf(null)).toBeNull();
    });
});
