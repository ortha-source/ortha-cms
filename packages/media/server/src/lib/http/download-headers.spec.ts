import { downloadHeadersFor, isInlineSafe } from './download-headers';

describe('isInlineSafe', () => {
    it.each([
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'video/mp4',
        'audio/mpeg',
        'application/pdf',
        'text/plain',
        'IMAGE/PNG',
        'image/png; charset=binary'
    ])('renders %p inline', (mimeType) => {
        expect(isInlineSafe(mimeType)).toBe(true);
    });

    it.each([
        'text/html',
        'application/xhtml+xml',
        // An image by MIME and by `MediaKind`, but a scriptable document when
        // navigated to — the whole reason the allowlist is not `image/*`.
        'image/svg+xml',
        'application/xml',
        'text/xml',
        'application/json',
        'application/octet-stream',
        'application/x-httpd-php',
        ''
    ])('forces %p to download', (mimeType) => {
        expect(isInlineSafe(mimeType)).toBe(false);
    });
});

describe('downloadHeadersFor', () => {
    it('always sends nosniff and a no-capability CSP [media:I-19]', () => {
        const { headers } = downloadHeadersFor('image/png', 'logo.png');

        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['Content-Security-Policy']).toContain(
            "default-src 'none'"
        );
        expect(headers['Content-Security-Policy']).toContain('sandbox');
    });

    it('marks a safe type inline and anything else as an attachment', () => {
        expect(downloadHeadersFor('image/png', 'a.png').disposition).toBe(
            'inline; filename="a.png"'
        );
        expect(downloadHeadersFor('text/html', 'a.html').disposition).toBe(
            'attachment; filename="a.html"'
        );
    });

    it('percent-encodes the file name so it cannot break the header', () => {
        // `media_asset.name` is stored verbatim, NUL bytes and quotes included.
        const { disposition } = downloadHeadersFor(
            'image/png',
            'we"ird\r\nname.png'
        );

        expect(disposition).not.toContain('\r');
        expect(disposition).not.toContain('\n');
        expect(disposition).toBe(
            `inline; filename="${encodeURIComponent('we"ird\r\nname.png')}"`
        );
    });
});
