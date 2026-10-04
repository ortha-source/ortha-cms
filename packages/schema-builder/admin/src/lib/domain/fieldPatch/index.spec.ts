import { patchAdmin, patchSpec } from './index';

describe('fieldPatch', () => {
    it('sets an option and drops one set to nothing, so it falls back to the DSL default', () => {
        expect(
            patchSpec({ type: 'text', maxLength: 10 }, { minLength: 2 })
        ).toEqual({ type: 'text', maxLength: 10, minLength: 2 });
        expect(
            patchSpec({ type: 'text', maxLength: 10 }, { maxLength: undefined })
        ).toEqual({ type: 'text' });
        expect(
            patchSpec({ type: 'number', min: 1 }, { min: Number.NaN })
        ).toEqual({ type: 'number' });
        expect(
            patchSpec({ type: 'text', pattern: 'x' }, { pattern: '' })
        ).toEqual({ type: 'text' });
    });

    it('patches display options and keeps keys the builder does not know [schema-builder:I-13]', () => {
        expect(
            patchAdmin(
                { type: 'text', admin: { label: 'A', future: 1 } },
                { description: 'Hi' }
            )
        ).toEqual({
            type: 'text',
            admin: { label: 'A', future: 1, description: 'Hi' }
        });
    });

    it('leaves admin out once it is empty', () => {
        expect(
            patchAdmin({ type: 'text', admin: { label: 'A' } }, { label: '' })
        ).toEqual({ type: 'text' });
    });
});
