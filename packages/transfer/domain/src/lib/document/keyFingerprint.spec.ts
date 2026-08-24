import { keyFingerprint } from './transfer-document';

describe('keyFingerprint', () => {
    it('is order-independent across the key fields', () => {
        expect(keyFingerprint('sku', { a: '1', b: '2' })).toBe(
            keyFingerprint('sku', { b: '2', a: '1' })
        );
    });

    it('separates two locales of the same key', () => {
        // The whole reason the locale is in here: a localized type's key values
        // are per-row, and a translation may share a slug with its source.
        expect(keyFingerprint('article', { slug: 'hello' }, 'en')).not.toBe(
            keyFingerprint('article', { slug: 'hello' }, 'de')
        );
    });

    it('treats a missing locale as its own bucket, not as any locale', () => {
        expect(keyFingerprint('post', { slug: 'a' })).not.toBe(
            keyFingerprint('post', { slug: 'a' }, 'en')
        );
    });

    it('cannot be forged by a value containing the separator', () => {
        // Any separator character a slug could contain would collapse these two
        // into one key; JSON encoding is what keeps them apart.
        expect(keyFingerprint('t', { a: '1', b: '2' })).not.toBe(
            keyFingerprint('t', { 'a": "1", "b': '2' })
        );
        expect(keyFingerprint('t', { a: 'x y' })).not.toBe(
            keyFingerprint('t', { a: 'x', y: '' })
        );
    });
});
