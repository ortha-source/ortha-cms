import {
    assertProvisionableDomains,
    isProvisionableEmail
} from './sso-provisioning-policy';

describe('isProvisionableEmail', () => {
    it('admits an address in an allowed domain', () => {
        expect(isProvisionableEmail('ada@acme.com', ['acme.com'])).toBe(true);
    });

    it('matches case-insensitively on both sides', () => {
        expect(isProvisionableEmail('Ada@ACME.com', ['Acme.COM'])).toBe(true);
    });

    it('refuses a domain that merely ends with an allowed one [identity:I-24]', () => {
        // The whole point of the check. A suffix match would admit an attacker
        // who registers `evil-acme.com` and stands up an identity provider on
        // it, which is not a theoretical shape of attack.
        expect(isProvisionableEmail('ada@evil-acme.com', ['acme.com'])).toBe(
            false
        );
    });

    it('refuses a subdomain that was not listed', () => {
        expect(isProvisionableEmail('ada@mail.acme.com', ['acme.com'])).toBe(
            false
        );
    });

    it('admits a subdomain that was listed', () => {
        expect(
            isProvisionableEmail('ada@mail.acme.com', ['mail.acme.com'])
        ).toBe(true);
    });

    it('refuses everything when no domain is allowed', () => {
        expect(isProvisionableEmail('ada@acme.com', [])).toBe(false);
    });

    it.each([
        ['no at sign', 'ada.example.com'],
        ['a leading at sign', '@acme.com'],
        ['a trailing at sign', 'ada@'],
        ['an empty string', '']
    ])('refuses an address with %s', (_label, email) => {
        expect(isProvisionableEmail(email, ['acme.com'])).toBe(false);
    });

    it('uses the last at sign, as an address with a quoted local part has', () => {
        expect(isProvisionableEmail('"a@b"@acme.com', ['acme.com'])).toBe(true);
    });
});

describe('assertProvisionableDomains', () => {
    it('accepts a list of bare domains', () => {
        expect(() =>
            assertProvisionableDomains(['acme.com', 'acme.co.uk'])
        ).not.toThrow();
    });

    it('refuses an empty list, rather than provisioning for everyone', () => {
        expect(() => assertProvisionableDomains([])).toThrow(
            /at least one email domain/
        );
    });

    it('refuses a blank entry left by a stray comma', () => {
        expect(() => assertProvisionableDomains(['acme.com', '  '])).toThrow(
            /must not be blank/
        );
    });

    it.each([
        ['an address', '@acme.com'],
        ['a URL', 'https://acme.com'],
        ['a host with a port', 'acme.com:443']
    ])('refuses %s, which can never match', (_label, domain) => {
        expect(() => assertProvisionableDomains([domain])).toThrow(
            /bare domain/
        );
    });
});
