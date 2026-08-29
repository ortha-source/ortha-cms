import {
    DEFAULT_URL_POLICY,
    WebhookUrlRejectedError,
    assertAddressAllowed,
    assertUrlShape,
    isPrivateAddress
} from './url-policy';

describe('assertUrlShape', () => {
    it('accepts an ordinary https URL', () => {
        expect(assertUrlShape('https://example.com/hooks').hostname).toBe(
            'example.com'
        );
    });

    it.each([
        ['ftp://example.com/x', 'a scheme that is not HTTP'],
        ['http://example.com/x', 'plain HTTP under the default policy'],
        ['https://user:pw@example.com/x', 'credentials in the URL'],
        ['not-a-url', 'a string that is not a URL']
    ])('rejects %s (%s)', (raw) => {
        expect(() => assertUrlShape(raw)).toThrow(WebhookUrlRejectedError);
    });

    it('accepts plain HTTP only when the deployment opted in', () => {
        expect(() =>
            assertUrlShape('http://example.com/x', {
                ...DEFAULT_URL_POLICY,
                allowInsecureUrls: true
            })
        ).not.toThrow();
    });

    it('rejects a literal private address without waiting for the worker', () => {
        expect(() => assertUrlShape('https://127.0.0.1/hooks')).toThrow(
            /private or reserved/
        );
    });

    it('lets a self-hosted deployment reach its own network deliberately', () => {
        expect(() =>
            assertUrlShape('https://10.0.0.5/hooks', {
                ...DEFAULT_URL_POLICY,
                allowPrivateNetworks: true
            })
        ).not.toThrow();
    });

    it('passes a hostname through — only the resolver can judge it', () => {
        expect(() =>
            assertUrlShape('https://internal.example.com/hooks')
        ).not.toThrow();
    });
});

describe('isPrivateAddress', () => {
    it.each([
        '0.0.0.0',
        '10.1.2.3',
        '100.64.0.1',
        '127.0.0.1',
        // The one that matters most: the cloud instance metadata endpoint.
        '169.254.169.254',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '198.18.0.1',
        '224.0.0.1',
        '255.255.255.255',
        '::',
        '::1',
        'fc00::1',
        'fd12:3456::1',
        'fe80::1',
        'ff02::1',
        // IPv4 wearing IPv6 notation — the classic way past a naive check.
        '::ffff:127.0.0.1',
        '::ffff:169.254.169.254'
    ])('blocks %s', (address) => {
        expect(isPrivateAddress(address)).toBe(true);
    });

    it.each([
        '1.1.1.1',
        '8.8.8.8',
        '93.184.216.34',
        '172.32.0.1',
        '11.0.0.1',
        '2606:4700:4700::1111',
        '::ffff:93.184.216.34'
    ])('allows %s', (address) => {
        expect(isPrivateAddress(address)).toBe(false);
    });

    it('does not honour zero-padded octets that could smuggle a loopback', () => {
        // '010.0.0.1' is 8.0.0.1 to an octal parser and 10.0.0.1 to a decimal
        // one. Refusing to guess is the only safe reading, so it is not a
        // recognised IPv4 literal at all.
        expect(isPrivateAddress('010.0.0.1')).toBe(false);
        expect(() => assertUrlShape('https://010.0.0.1/x')).not.toThrow();
    });
});

describe('assertAddressAllowed', () => {
    it('refuses a public name that resolved to a private address', () => {
        expect(() => assertAddressAllowed('169.254.169.254')).toThrow(
            WebhookUrlRejectedError
        );
    });

    it('allows a public address', () => {
        expect(() => assertAddressAllowed('93.184.216.34')).not.toThrow();
    });

    it('is a no-op when private networks are permitted', () => {
        expect(() =>
            assertAddressAllowed('127.0.0.1', {
                ...DEFAULT_URL_POLICY,
                allowPrivateNetworks: true
            })
        ).not.toThrow();
    });
});
