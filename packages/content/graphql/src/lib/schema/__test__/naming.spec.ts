import {
    assertNoNameCollisions,
    camelCase,
    collisionBetween,
    enumValueName,
    namesFor,
    pascalCase,
    pluralize
} from '../naming';

describe('naming', () => {
    describe('case conversion', () => {
        it.each([
            ['article', 'Article'],
            ['blog_post', 'BlogPost'],
            ['seo_meta_tag', 'SeoMetaTag'],
            ['a', 'A']
        ])('pascalCases %s → %s', (input, expected) => {
            expect(pascalCase(input)).toBe(expected);
        });

        it('camelCases the same split', () => {
            expect(camelCase('blog_post')).toBe('blogPost');
        });
    });

    describe('pluralize', () => {
        it.each([
            ['article', 'articles'],
            ['category', 'categories'],
            ['box', 'boxes'],
            ['dish', 'dishes'],
            // A vowel before the `y` keeps it: `day` → `days`, not `daies`.
            ['day', 'days']
        ])('%s → %s', (input, expected) => {
            expect(pluralize(input)).toBe(expected);
        });
    });

    describe('namesFor', () => {
        it('derives every name of a type from its slug', () => {
            expect(namesFor('blog_post')).toEqual({
                object: 'BlogPost',
                list: 'BlogPostList',
                input: 'BlogPostInput',
                relationsInput: 'BlogPostRelationsInput',
                single: 'blogPost',
                plural: 'blogPosts',
                mutations: {
                    create: 'createBlogPost',
                    update: 'updateBlogPost',
                    publish: 'publishBlogPost',
                    unpublish: 'unpublishBlogPost',
                    remove: 'deleteBlogPost'
                }
            });
        });
    });

    describe('enumValueName', () => {
        it('passes a name that is already legal', () => {
            expect(enumValueName('draft')).toBe('draft');
        });

        it('sanitises separators into a name that maps back', () => {
            // A rename, unavoidably — GraphQL has no other spelling for an
            // enum value. What matters is that it is unambiguous.
            expect(enumValueName('in-progress')).toBe('in_progress');
        });

        it('refuses an option that cannot start a GraphQL name', () => {
            // Renaming it would make the API disagree with the stored value, so
            // the caller falls back to `String` for the whole field instead.
            expect(enumValueName('2024')).toBeNull();
        });

        it('keeps a sanitised name even when nothing recognisable survives', () => {
            // `_` is a legal GraphQL name, so this one option round-trips. Two
            // such options would collide, and `selectEnum` falls the whole field
            // back to `String` rather than serve an ambiguous mapping.
            expect(enumValueName('—')).toBe('_');
        });
    });

    describe('collision detection', () => {
        it('catches two slugs mapping to one object type', () => {
            expect(collisionBetween('blog_post', 'blogPost')).toMatch(
                /GraphQL type "BlogPost"/
            );
        });

        it('catches a plural colliding with another type’s singular', () => {
            // `article` → `articles`, which is also what a type literally named
            // `articles` would claim as its singular field.
            expect(collisionBetween('article', 'articles')).toMatch(
                /query fields collide/
            );
        });

        it('passes unrelated names', () => {
            expect(collisionBetween('article', 'author')).toBeNull();
        });

        it('fails the whole registry loudly rather than per workspace', () => {
            expect(() =>
                assertNoNameCollisions(['blog_post', 'author', 'blogPost'])
            ).toThrow(/cannot both be served over GraphQL/);
        });

        it('accepts a registry with no collisions', () => {
            expect(() =>
                assertNoNameCollisions(['article', 'author', 'tag'])
            ).not.toThrow();
        });
    });
});
