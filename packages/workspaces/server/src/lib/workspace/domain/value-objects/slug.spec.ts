import { Slug } from './slug';
import { InvalidSlugError } from '../errors';

describe('Slug value object', () => {
    it('accepts lowercase letters, digits, and hyphens', () => {
        expect(Slug.create('marketing-01').value).toBe('marketing-01');
    });

    it.each([
        ['empty', ''],
        ['uppercase', 'Marketing'],
        ['spaces', 'my workspace'],
        ['punctuation', 'oops!'],
        ['underscore', 'blog_post']
    ])('rejects a %s slug', (_label, value) => {
        expect(() => Slug.create(value)).toThrow(InvalidSlugError);
    });

    it('rejects a slug longer than 120 characters', () => {
        expect(() => Slug.create('a'.repeat(121))).toThrow(InvalidSlugError);
    });
});
