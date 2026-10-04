import { checkHasFields } from './check-has-fields';

describe('checkHasFields', () => {
    it('rejects a type with no fields', () => {
        expect(
            checkHasFields({
                name: 'empty',
                kind: 'collection',
                i18n: false,
                fields: {}
            })
        ).toEqual([
            {
                path: 'empty',
                code: 'type.no-fields',
                message: 'Content type "empty" defines no fields.'
            }
        ]);
    });

    it('accepts one field', () => {
        expect(
            checkHasFields({
                name: 'post',
                kind: 'collection',
                i18n: false,
                fields: { title: { type: 'text', required: false } }
            })
        ).toEqual([]);
    });
});
