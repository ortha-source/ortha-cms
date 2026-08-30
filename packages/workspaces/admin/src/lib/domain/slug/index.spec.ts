import { describe, expect, it } from 'vitest';
import { Slug } from './index';

/**
 * The admin's slug rule. Its whole job is to be **the same rule as the
 * server's**, so the wizard never offers a slug the API then refuses.
 *
 * The source of truth is
 * `packages/workspaces/server/src/lib/workspace/domain/value-objects/slug.ts`
 * (`^[a-z0-9-]+$`, 1–120 characters), pinned by its own
 * `slug.spec.ts`. The admin cannot import the server package — no admin package
 * depends on a server one, and none may start — so the corpus below is that
 * spec's, transcribed deliberately. If the server rule ever moves, this spec is
 * meant to go red rather than let the two drift apart in silence.
 *
 * The cases that actually catch drift are the near-misses. `blog_post` is the
 * one a hand-written client regex most often lets through, because `\w` and most
 * "slugify" helpers treat the underscore as a word character while the server
 * does not; and 120 vs. 121 is a boundary an admin-side copy is free to get off
 * by one, since nothing but this test compares the two numbers.
 */
describe('Slug (admin mirror of the server rule)', () => {
    it.each([
        ['lowercase letters', 'marketing'],
        ['letters, digits and hyphens', 'marketing-01'],
        ['a single character', 'a'],
        ['exactly 120 characters', 'a'.repeat(120)]
    ])('accepts %s', (_label, value) => {
        expect(Slug.isValid(value)).toBe(true);
        expect(Slug.create(value).value).toBe(value);
    });

    it.each([
        ['empty', ''],
        ['uppercase', 'Marketing'],
        ['spaces', 'my workspace'],
        ['punctuation', 'oops!'],
        ['underscore', 'blog_post'],
        ['121 characters', 'a'.repeat(121)]
    ])('rejects a %s slug', (_label, value) => {
        expect(Slug.isValid(value)).toBe(false);
        expect(() => Slug.create(value)).toThrow(/Invalid workspace slug/);
    });

    // `isValid` is the field's live feedback and `create` is the last guard
    // before the request; they have to be one decision, not two that agree
    // today. The corpus above already asserts both for every case — this states
    // the relationship the two methods hold by construction.
    it('guards the request with the same answer the field showed', () => {
        expect(() => Slug.create('marketing-01')).not.toThrow();
        expect(() => Slug.create('blog_post')).toThrow();
    });
});
