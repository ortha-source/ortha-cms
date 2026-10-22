import { article } from '../../../testing/document';
import { builtInTabOf, fieldsOnTab } from './index';

describe('builtInTabOf', () => {
    it('puts every field on the one form, relations and media included', () => {
        expect(builtInTabOf({ type: 'relation', to: 'x' })).toBe('general');
        expect(builtInTabOf({ type: 'media' })).toBe('general');
        for (const type of [
            'text',
            'richtext',
            'number',
            'money',
            'boolean',
            'date',
            'datetime',
            'json'
        ] as const) {
            expect(builtInTabOf({ type })).toBe('general');
        }
        expect(builtInTabOf({ type: 'select', options: [] })).toBe('general');
    });
});

describe('fieldsOnTab', () => {
    it('keeps declaration order', () => {
        expect(fieldsOnTab(article, 'general').map((f) => f.name)).toEqual(
            article.fields.map((f) => f.name)
        );
    });
});
