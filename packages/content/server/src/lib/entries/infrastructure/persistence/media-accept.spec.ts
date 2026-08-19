import { acceptsAsset, describeAccept } from './media-accept';

const image = { kind: 'image', mimeType: 'image/png' };
const pdf = { kind: 'document', mimeType: 'application/pdf' };
const gif = { kind: 'image', mimeType: 'image/gif' };

describe('acceptsAsset', () => {
    it('accepts anything when no restriction is set', () => {
        expect(acceptsAsset(undefined, pdf)).toBe(true);
        expect(acceptsAsset({}, pdf)).toBe(true);
    });

    it('matches by coarse kind', () => {
        expect(acceptsAsset({ kinds: ['image'] }, image)).toBe(true);
        expect(acceptsAsset({ kinds: ['image'] }, pdf)).toBe(false);
    });

    it('matches an exact MIME type', () => {
        expect(acceptsAsset({ mimeTypes: ['application/pdf'] }, pdf)).toBe(
            true
        );
        expect(acceptsAsset({ mimeTypes: ['application/pdf'] }, image)).toBe(
            false
        );
    });

    it('matches a `type/*` MIME wildcard', () => {
        expect(acceptsAsset({ mimeTypes: ['image/*'] }, image)).toBe(true);
        expect(acceptsAsset({ mimeTypes: ['image/*'] }, gif)).toBe(true);
        expect(acceptsAsset({ mimeTypes: ['image/*'] }, pdf)).toBe(false);
    });

    it('passes when it matches ANY listed kind or MIME (OR semantics)', () => {
        const accept = { kinds: ['video'], mimeTypes: ['application/pdf'] };
        expect(acceptsAsset(accept, pdf)).toBe(true); // matched by MIME
        expect(
            acceptsAsset(accept, { kind: 'video', mimeType: 'video/mp4' })
        ).toBe(true); // matched by kind
        expect(acceptsAsset(accept, image)).toBe(false); // neither
    });
});

describe('describeAccept', () => {
    it('describes kinds and MIME patterns', () => {
        expect(describeAccept({ kinds: ['image'] })).toContain('image');
        expect(describeAccept({ mimeTypes: ['application/pdf'] })).toContain(
            'application/pdf'
        );
    });

    it('falls back to a generic phrase without a restriction', () => {
        expect(describeAccept(undefined)).toBe('an allowed asset');
    });
});
