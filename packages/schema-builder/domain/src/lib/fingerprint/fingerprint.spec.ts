import { documentOf, typeOf } from '../../testing/fixtures';
import { fingerprint } from './fingerprint';
import { fnv1a } from './fnv1a';

describe('fingerprint', () => {
    const doc = documentOf(
        typeOf('tag', { name: { type: 'text', maxLength: 40 } })
    );

    it('is sixteen hex characters', () => {
        expect(fingerprint(doc)).toMatch(/^[0-9a-f]{16}$/);
    });

    it('ignores key order and undefined keys', () => {
        const reordered = JSON.parse(JSON.stringify(doc), (_key, value) =>
            value && typeof value === 'object' && !Array.isArray(value)
                ? Object.fromEntries(Object.entries(value).reverse())
                : value
        );
        expect(fingerprint({ ...reordered, extra: undefined })).toBe(
            fingerprint(doc)
        );
    });

    it('changes with any change to the content model', () => {
        const changed = documentOf(
            typeOf('tag', { name: { type: 'text', maxLength: 41 } })
        );
        expect(fingerprint(changed)).not.toBe(fingerprint(doc));
    });

    it('matches the reference FNV-1a vector', () => {
        // FNV-1a 32 of "a" with the standard offset basis.
        expect(fnv1a('a', 0x811c9dc5).toString(16)).toBe('e40c292c');
    });
});
