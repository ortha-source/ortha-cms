import { field } from '@orthacms/content-server/define';
import { post } from '../../../testing/types';
import { toFieldDoc } from './to-field-doc';

const docOf = (field: keyof typeof post.fields) =>
    toFieldDoc(post.fields[field]);

describe('toFieldDoc', () => {
    it('carries required, localized and the text rules', () => {
        expect(docOf('title')).toEqual({
            type: 'text',
            required: true,
            localized: true,
            minLength: 3,
            pattern: '^[A-Z]',
            admin: { placeholder: 'Title', future: { kept: true } }
        });
    });

    it('carries the richtext rules and lang', () => {
        expect(docOf('body')).toEqual({
            type: 'richtext',
            lang: 'en',
            maxLength: 5000,
            structure: 'on'
        });
    });

    it('carries the number rules, integer included', () => {
        expect(docOf('rating')).toEqual({
            type: 'number',
            integer: true,
            min: 0,
            max: 5
        });
    });

    it("drops money's integer — minor units are the DSL's, not the author's", () => {
        expect(docOf('price')).toEqual({ type: 'money', min: 0 });
    });

    it('copies choice options', () => {
        expect(docOf('kind')).toEqual({ type: 'select', options: ['a', 'b'] });
        expect(docOf('tags')).toEqual({ type: 'multiselect', options: ['x'] });
    });

    it('carries a default value, the relative ones included', () => {
        expect(
            toFieldDoc(field.select({ options: ['a', 'b'], defaultValue: 'b' }))
        ).toEqual({ type: 'select', options: ['a', 'b'], defaultValue: 'b' });
        expect(toFieldDoc(field.date({ defaultValue: 'today' }))).toEqual({
            type: 'date',
            defaultValue: 'today'
        });
        expect(toFieldDoc(field.boolean())).not.toHaveProperty('defaultValue');
    });

    it('copies media accept and multiple', () => {
        expect(docOf('cover')).toEqual({
            type: 'media',
            accept: { kinds: ['image'], mimeTypes: ['image/png'] }
        });
        expect(docOf('gallery')).toEqual({ type: 'media', multiple: true });
    });

    it('merges the relation into the field', () => {
        expect(docOf('lead')).toEqual({
            type: 'relation',
            to: 'sb_author',
            unique: true
        });
    });

    it('leaves admin out when it is empty, and keeps unknown keys when it is not', () => {
        expect(docOf('rating')).not.toHaveProperty('admin');
        expect(docOf('slug')).toEqual({
            type: 'text',
            admin: { group: 'seo' }
        });
    });

    it('returns a copy — editing the document never reaches the registry', () => {
        const doc = docOf('title') as unknown as {
            admin: { future: { kept: boolean } };
        };
        doc.admin.future.kept = false;
        expect(
            (post.fields.title.admin as { future: { kept: boolean } }).future
                .kept
        ).toBe(true);
    });
});
