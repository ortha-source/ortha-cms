import { newFieldKey, toFieldName, toTypeName, uniqueName } from './index';

describe('identifiers', () => {
    it('makes a camelCase field name from a label', () => {
        expect(toFieldName('Publish date')).toBe('publishDate');
        expect(toFieldName('  SEO title! ')).toBe('seoTitle');
        expect(toFieldName('Événement')).toBe('evenement');
        expect(toFieldName('3D model')).toBe('f3dModel');
        expect(toFieldName('---')).toBe('');
    });

    it('makes a snake_case type name from a label', () => {
        expect(toTypeName('Blog posts')).toBe('blog_posts');
        expect(toTypeName('FAQ Entries')).toBe('faq_entries');
        expect(toTypeName('2024 events')).toBe('t_2024_events');
    });

    it('picks the first free name', () => {
        expect(uniqueName('title', ['body'])).toBe('title');
        expect(uniqueName('title', ['title', 'title2'])).toBe('title3');
    });

    it('keys a new field so it can never be mistaken for a loaded one', () => {
        expect(newFieldKey()).toMatch(/^new:/);
        expect(newFieldKey()).not.toBe(newFieldKey());
    });
});
