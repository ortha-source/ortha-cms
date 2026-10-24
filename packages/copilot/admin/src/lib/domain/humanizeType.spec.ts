import { humanizeType } from './humanizeType';

describe('humanizeType', () => {
    it('turns a machine name into words', () => {
        expect(humanizeType('blog-posts')).toBe('Blog posts');
        expect(humanizeType('site_settings')).toBe('Site settings');
        expect(humanizeType('article')).toBe('Article');
    });

    it('leaves an empty name alone', () => {
        expect(humanizeType('')).toBe('');
    });
});
