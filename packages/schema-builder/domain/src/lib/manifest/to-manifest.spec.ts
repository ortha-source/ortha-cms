import { documentOf, typeOf } from '../../testing/fixtures';
import { toManifest } from './to-manifest';

describe('toManifest', () => {
    it('lists each type with its owning many-relations only', () => {
        const article = typeOf('article', {
            tags: { type: 'relation', to: 'tag', many: true },
            author: { type: 'relation', to: 'author' },
            comments: { type: 'relation', to: 'comment', inverseOf: 'article' }
        });
        const home = typeOf(
            'home_page',
            { title: { type: 'text' } },
            { kind: 'single', path: '/' }
        );
        expect(toManifest(documentOf(article, home))).toEqual([
            { name: 'article', kind: 'collection', joinFields: ['tags'] },
            { name: 'home_page', kind: 'single', joinFields: [] }
        ]);
    });
});
