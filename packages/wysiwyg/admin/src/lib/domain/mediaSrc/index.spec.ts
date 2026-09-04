import { isSafeMediaSrc, safeMediaSrc } from '.';

/**
 * What a media node's `src` is allowed to be.
 *
 * The e2e case pins the *dialog's* half — the author is told why nothing was
 * inserted. This is the rule underneath it, which also runs on `parseHTML`,
 * where there is nobody to tell: a body written straight through the API, or
 * pasted out of another site, is the path the stored content actually needs
 * protecting on.
 */
describe('isSafeMediaSrc', () => {
    it.each([
        ['https://cdn.example.com/a.png', 'an absolute https URL'],
        ['http://cdn.example.com/a.png', 'an absolute http URL'],
        ['/api/media/assets/a1/raw', 'the same-origin path the library serves'],
        ['assets/a1.png', 'a relative path']
    ])('accepts %s (%s)', (src) => {
        expect(isSafeMediaSrc(src)).toBe(true);
    });

    it('refuses a protocol-relative URL [wysiwyg:I-21]', () => {
        // The case a scheme allowlist alone misses: `//host/x` has no scheme to
        // check — it inherits whichever one the *consumer* is on, which is not
        // something this editor can vouch for. It is also the shape that looks
        // most like the same-origin path above.
        expect(isSafeMediaSrc('//evil.example.com/a.png')).toBe(false);
    });

    it.each([
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        'file:///etc/passwd'
    ])('refuses %s', (src) => {
        expect(isSafeMediaSrc(src)).toBe(false);
    });

    it.each([
        ['', 'empty'],
        ['   ', 'whitespace']
    ])('refuses %s (%s)', (src) => {
        expect(isSafeMediaSrc(src)).toBe(false);
    });

    it('refuses anything that is not a string', () => {
        // `parseHTML` and `renderHTML` both hand it whatever the stored
        // attributes hold, which is `unknown`.
        for (const value of [null, undefined, 42, {}, ['/a.png']]) {
            expect(isSafeMediaSrc(value)).toBe(false);
        }
    });
});

describe('safeMediaSrc', () => {
    it('blanks a refused src rather than passing it through', () => {
        expect(safeMediaSrc('javascript:alert(1)')).toBe('');
    });

    it('trims an accepted one', () => {
        expect(safeMediaSrc('  /api/media/assets/a1/raw  ')).toBe(
            '/api/media/assets/a1/raw'
        );
    });
});
