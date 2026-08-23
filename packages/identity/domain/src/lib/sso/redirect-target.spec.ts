import { safeRedirectPath } from './redirect-target';

describe('safeRedirectPath', () => {
    it('keeps a same-origin absolute path', () => {
        expect(safeRedirectPath('/workspaces/1/entries')).toBe(
            '/workspaces/1/entries'
        );
    });

    it('keeps a query string and a fragment', () => {
        expect(safeRedirectPath('/entries?page=2#top')).toBe(
            '/entries?page=2#top'
        );
    });

    it.each([
        ['an absolute URL', 'https://evil.test/'],
        ['a bare host', 'evil.test'],
        ['a protocol-relative URL', '//evil.test/'],
        ['a backslash-smuggled host', '/\\evil.test'],
        ['a scheme with no slash', 'javascript:alert(1)'],
        ['an embedded newline', '/ok\nLocation: https://evil.test'],
        ['an embedded tab', '/ok\ttail'],
        ['a leading space', ' /ok'],
        ['an empty string', ''],
        ['undefined', undefined],
        ['null', null]
    ])('falls back for %s', (_label, input) => {
        expect(safeRedirectPath(input as string | undefined)).toBe('/');
    });

    it('uses the supplied fallback', () => {
        expect(safeRedirectPath('https://evil.test', '/identity/signin')).toBe(
            '/identity/signin'
        );
    });
});
