import { home, post } from '../../../testing/types';
import { toGroupDocs } from './to-group-docs';
import { toTypeDoc } from './to-type-doc';

describe('toTypeDoc', () => {
    it('reads the type options and the origin it is given', () => {
        expect(toTypeDoc(post, 'builder')).toMatchObject({
            name: 'sb_post',
            kind: 'collection',
            label: 'Posts',
            description: 'Blog posts.',
            publishable: true,
            paranoid: true,
            i18n: true,
            origin: 'builder'
        });
    });

    it('drops a label that only repeats the name, and keeps a single path', () => {
        const doc = toTypeDoc(home, 'code');
        expect(doc).not.toHaveProperty('label');
        expect(doc).toMatchObject({ kind: 'single', path: '/' });
    });

    it('keys fields by type and name, in declaration order', () => {
        const doc = toTypeDoc(post, 'code');
        expect(doc.fields.map((entry) => entry.key)).toEqual(
            Object.keys(post.fields).map((name) => `sb_post.${name}`)
        );
        expect(doc.fields[0]).toMatchObject({
            name: 'title',
            spec: { type: 'text' }
        });
    });
});

describe('toGroupDocs', () => {
    it('keeps order and leaves defaults implicit', () => {
        expect(toGroupDocs(post)).toEqual([
            {
                key: 'seo',
                label: 'SEO',
                description: 'Search',
                collapsed: true
            },
            { key: 'misc', label: 'Misc' }
        ]);
    });

    it('reads no groups as an empty list', () => {
        expect(toGroupDocs(home)).toEqual([]);
    });
});
