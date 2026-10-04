import { article } from '../../../testing/document';
import { builtInTabOf, fieldsOnTab } from './index';

describe('builtInTabOf', () => {
    it('sends relations and media to their own tabs, everything else to General', () => {
        expect(builtInTabOf({ type: 'relation', to: 'x' })).toBe('relations');
        expect(builtInTabOf({ type: 'media' })).toBe('media');
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
        expect(fieldsOnTab(article, 'general').map((f) => f.name)).toEqual([
            'body',
            'title',
            'kind',
            'slug'
        ]);
        expect(fieldsOnTab(article, 'relations').map((f) => f.name)).toEqual([
            'author'
        ]);
        expect(fieldsOnTab(article, 'media').map((f) => f.name)).toEqual([
            'cover'
        ]);
    });
});
