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
        '::ffff:169.254.169.254',
        // ...and the same, as a resolver or the URL parser spells them.
        '::ffff:7f00:1',
        '::ffff:a9fe:a9fe',
        'fe80::1%eth0'
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

describe('[webhooks:I-10] IPv6 literals as the URL parser hands them over', () => {
    // WHATWG URL rewrites an embedded dotted-quad into hex groups, so
    // `[::ffff:169.254.169.254]` reaches the policy as `::ffff:a9fe:a9fe` —
    // and undici never runs a lookup for an IP literal, so this is the only
    // check that sees it.
    const host = (raw: string): string =>
        new URL(raw).hostname.replace(/^\[|\]$/g, '');

    it.each([
        ['https://[::ffff:169.254.169.254]/', 'IPv4-mapped metadata'],
        ['https://[::ffff:127.0.0.1]/', 'IPv4-mapped loopback'],
        ['https://[::ffff:10.0.0.1]/', 'IPv4-mapped RFC 1918'],
        ['https://[::ffff:0:127.0.0.1]/', 'IPv4-translated loopback'],
        ['https://[::127.0.0.1]/', 'IPv4-compatible loopback'],
        ['https://[64:ff9b::169.254.169.254]/', 'NAT64 of metadata'],
        ['https://[64:ff9b:1::1]/', 'local-use NAT64'],
        ['https://[2002:a9fe:a9fe::]/', '6to4 of metadata'],
        ['https://[2002:7f00:1::1]/', '6to4 of loopback'],
        ['https://[0:0:0:0:0:0:0:1]/', 'loopback, uncompressed'],
        ['https://[0:0:0:0:0:0:0:0]/', 'unspecified, uncompressed'],
        ['https://[FE80:0:0:0:0:0:0:1]/', 'link-local, upper case'],
        ['https://[fd00:0:0:0:0:0:0:1]/', 'unique-local, uncompressed'],
        ['https://[ff05::2]/', 'multicast']
    ])('blocks %s (%s)', (raw) => {
        expect(isPrivateAddress(host(raw))).toBe(true);
        expect(() => assertUrlShape(raw)).toThrow(/private or reserved/);
    });

    it.each([
        'https://[::ffff:93.184.216.34]/',
        'https://[64:ff9b::93.184.216.34]/',
        'https://[2002:5db8:d822::1]/',
        'https://[2606:4700:4700::1111]/',
        'https://[2001:db8:0:0:1:0:0:1]/'
    ])('allows %s', (raw) => {
        expect(isPrivateAddress(host(raw))).toBe(false);
        expect(() => assertUrlShape(raw)).not.toThrow();
    });

    it('refuses an address it cannot parse rather than guessing', () => {
        expect(isPrivateAddress('1:2:3')).toBe(true);
        expect(isPrivateAddress('1::2::3')).toBe(true);
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
