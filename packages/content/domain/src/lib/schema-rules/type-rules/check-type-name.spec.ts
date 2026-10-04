import { checkTypeName } from './check-type-name';

const type = (name: string) => ({
    name,
    kind: 'collection' as const,
    i18n: false,
    fields: {}
});

describe('checkTypeName', () => {
    it.each(['article', 'home_page', 'a1'])('accepts %s', (name) => {
        expect(checkTypeName(type(name))).toEqual([]);
    });

    it.each(['Article', '1st', 'home-page', '_x', ''])(
        'rejects %j with the DSL message',
        (name) => {
            expect(checkTypeName(type(name))).toEqual([
                {
                    path: name,
                    code: 'type.name',
                    message: `Content type name "${name}" must be snake_case (letters, digits, underscores; starting with a letter).`
                }
            ]);
        }
    );
});
