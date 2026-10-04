import { documentOf, typeOf } from '../../testing/fixtures';
import { checkDocumentShape } from './check-document-shape';

describe('checkDocumentShape', () => {
    const valid = documentOf(
        typeOf('post', {
            title: { type: 'text' },
            kind: { type: 'select', options: ['a'] },
            author: { type: 'relation', to: 'author' }
        }),
        typeOf(
            'author',
            { name: { type: 'text' } },
            { kind: 'single', origin: 'code' }
        )
    );

    it('accepts a well-formed document', () => {
        expect(checkDocumentShape(valid)).toEqual([]);
    });

    it('refuses what is not a document at all', () => {
        expect(checkDocumentShape(null)).toEqual(['document is not an object']);
        expect(checkDocumentShape({ version: 2, types: {} })).toEqual([
            'document.version is not 1',
            'document.types is not a list'
        ]);
    });

    it('names each problem by its path', () => {
        const bad = {
            version: 1,
            types: [
                {
                    name: '',
                    kind: 'table',
                    origin: 'x',
                    publishable: 1,
                    paranoid: false,
                    i18n: false,
                    groups: [{}],
                    fields: 'no'
                }
            ]
        };
        expect(checkDocumentShape(bad)).toEqual([
            'types[0].name is missing',
            'types[0].kind is not collection or single',
            'types[0].origin is not builder, code or new',
            'types[0].publishable is not a boolean',
            'types[0].groups is not a list of { key, label }',
            'types[0].fields is not a list'
        ]);
    });

    it('checks each field: key, name, a real type, and the parts a type needs', () => {
        const type = typeOf('t', {});
        const bad = documentOf({
            ...type,
            fields: [
                { key: 't.a', name: 'a', spec: { type: 'colour' } },
                { key: 't.b', name: 'b', spec: { type: 'select' } },
                { key: 't.c', name: 'c', spec: { type: 'relation' } },
                {
                    key: 't.d',
                    name: 'd',
                    spec: { type: 'text', admin: 'wide' }
                },
                { name: 'e', spec: { type: 'text' } }
            ] as never
        });
        expect(checkDocumentShape(bad)).toEqual([
            'types[0].fields[0].spec.type is not a field type',
            'types[0].fields[1].spec.options is not a list',
            'types[0].fields[2].spec.to is missing',
            'types[0].fields[3].spec.admin is not an object',
            'types[0].fields[4].key is missing'
        ]);
    });

    it('refuses two fields with one key — the diff matches by key', () => {
        const type = typeOf('t', { a: { type: 'text' } });
        const twice = documentOf({
            ...type,
            fields: [type.fields[0], { ...type.fields[0], name: 'b' }]
        });
        expect(checkDocumentShape(twice)).toEqual([
            'types[0].fields repeats a key'
        ]);
    });
});
