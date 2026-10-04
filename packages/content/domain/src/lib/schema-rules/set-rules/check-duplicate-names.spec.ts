import { checkDuplicateNames } from './check-duplicate-names';

const type = (name: string) => ({
    name,
    kind: 'collection' as const,
    i18n: false,
    fields: {}
});

describe('checkDuplicateNames', () => {
    it('reports the second occurrence with the registry message', () => {
        expect(
            checkDuplicateNames([type('post'), type('tag'), type('post')])
        ).toEqual([
            {
                path: 'post',
                code: 'type.duplicate',
                message: 'Duplicate content type "post" — names must be unique.'
            }
        ]);
    });
});
