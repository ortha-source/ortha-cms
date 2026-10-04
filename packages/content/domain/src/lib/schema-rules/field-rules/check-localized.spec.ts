import { checkLocalized } from './check-localized';

const pass = { columns: new Map<string, string>() };
const field = { type: 'text', required: false, localized: true };
const type = (i18n: boolean) => ({
    name: 'post',
    kind: 'collection' as const,
    i18n,
    fields: { title: field }
});

describe('checkLocalized', () => {
    it('accepts localized on an i18n type', () => {
        expect(checkLocalized(type(true), 'title', field, pass)).toEqual([]);
    });

    it('rejects localized on a type without i18n', () => {
        expect(checkLocalized(type(false), 'title', field, pass)).toEqual([
            {
                path: 'post.fields.title',
                code: 'field.localized-without-i18n',
                message:
                    'Field "title" on "post" is localized, but the type does not set i18n: true.'
            }
        ]);
    });
});
