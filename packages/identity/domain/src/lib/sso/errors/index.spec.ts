import { SsoVerificationError, UnknownSsoProviderError } from './index';

/**
 * One error type for every rejection of an identity provider's response.
 *
 * The transport renders all of them as the same generic failure, so what
 * matters here is that the *reason* survives as a field the server log can
 * read — and that the type is recognisable by `name` after the class identity
 * has been lost across a bundle or a rethrow, which is how the conformance kit
 * and the callback route both tell a refusal from a fault.
 */
describe('SsoVerificationError', () => {
    it('keeps the reason as a field, for the log', () => {
        expect(
            new SsoVerificationError('the nonce does not match').reason
        ).toBe('the nonce does not match');
    });

    it('states the reason in the message, so a stack trace explains itself', () => {
        expect(
            new SsoVerificationError('the signature is invalid').message
        ).toBe('SSO verification failed: the signature is invalid.');
    });

    it('identifies itself by name, not only by class', () => {
        const error = new SsoVerificationError('expired');
        expect(error.name).toBe('SsoVerificationError');
        expect(error).toBeInstanceOf(Error);
    });
});

/**
 * A deployment misconfiguration, not an attack.
 *
 * The message names the registered set because the reader is an operator with a
 * typo in `plugins.ts` — and the empty case is the one that actually happens:
 * SSO is wired up before any provider is registered, and a message ending in
 * "Registered: ." would leave them guessing whether the list was empty or the
 * message was broken.
 */
describe('UnknownSsoProviderError', () => {
    it('lists the registered names, so the typo is visible', () => {
        const error = new UnknownSsoProviderError('okta', ['google', 'saml']);
        expect(error.message).toBe(
            'Unknown SSO provider "okta". Registered: google, saml.'
        );
    });

    it('says (none) when nothing is registered at all', () => {
        expect(new UnknownSsoProviderError('okta', []).message).toBe(
            'Unknown SSO provider "okta". Registered: (none).'
        );
    });

    it('keeps the requested name and the registered set as fields', () => {
        const error = new UnknownSsoProviderError('okta', ['google']);
        expect(error.providerName).toBe('okta');
        expect(error.registered).toEqual(['google']);
    });

    it('identifies itself by name, not only by class', () => {
        const error = new UnknownSsoProviderError('okta', []);
        expect(error.name).toBe('UnknownSsoProviderError');
        expect(error).toBeInstanceOf(Error);
    });
});
