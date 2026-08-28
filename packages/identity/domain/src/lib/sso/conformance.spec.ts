import {
    runSsoProviderConformance,
    SSO_PROVIDER_CONFORMANCE_CHECKS,
    type SsoProviderConformanceCase
} from './conformance';
import { SsoVerificationError } from './errors/sso-verification.error';
import type { SsoProfile } from './sso-profile';
import type {
    SsoAuthorizeRedirect,
    SsoAuthorizeRequest,
    SsoCallback,
    SsoProvider,
    SsoProviderDescriptor
} from './sso-provider';

/**
 * The one-attempt secrets a core would have minted. Fixed rather than random,
 * because "the URL never contains the verifier" must not pass by luck on a
 * short value that happened not to collide.
 */
const CORE_SECRETS: SsoAuthorizeRequest = {
    redirectUri: 'https://cms.example/api/auth/sso/stub/callback',
    state: 'state-2f6a1c9d',
    nonce: 'nonce-8b0e47aa',
    codeVerifier: 'verifier-4c1d55e0f39b2a7681ce'
};

/** The only authorization code the conforming stub will accept. */
const VALID_CODE = 'code-6d2f';

/** What a conforming `complete` hands back on the happy path. */
const VERIFIED_PROFILE: SsoProfile = {
    subject: 'idp-subject-1',
    email: 'ada@example.com',
    emailVerified: true,
    name: 'Ada'
};

const CONFORMING_DESCRIPTOR: SsoProviderDescriptor = Object.freeze({
    kind: 'oidc',
    label: 'Acme SSO',
    callbackMethod: 'GET'
});

/**
 * The parts of a conforming adapter one scenario replaces.
 *
 * The stub is deliberately hand-rolled here rather than imported from
 * `identity-provider-fake`: this package depends on nothing (ADR-0013 §1), and
 * a kit that could only be exercised through a shipped adapter would be tested
 * by the very code it exists to judge.
 */
interface StubBehaviour {
    /** Receives the 1-based call number, so a scenario can drift its answer. */
    descriptor?: (call: number) => SsoProviderDescriptor;
    authorize?: (request: SsoAuthorizeRequest) => SsoAuthorizeRedirect;
    complete?: (callback: SsoCallback) => SsoProfile;
}

/** An authorization URL that satisfies every clause the kit checks. */
function conformingAuthorize(
    request: SsoAuthorizeRequest
): SsoAuthorizeRedirect {
    const url = new URL('https://idp.example/authorize');
    url.searchParams.set('redirect_uri', request.redirectUri);
    url.searchParams.set('state', request.state);
    url.searchParams.set('nonce', request.nonce);
    // The challenge stands in for the verifier, which never leaves the server.
    url.searchParams.set(
        'code_challenge',
        `challenge-of-${request.codeVerifier.length}`
    );
    return { url: url.toString() };
}

/** A verifier that refuses every scenario the kit arms, and only those. */
function conformingComplete(callback: SsoCallback): SsoProfile {
    const { params } = callback;
    if (params['error']) {
        throw new SsoVerificationError(
            `the provider answered error=${params['error']}`
        );
    }
    if (params['state'] !== callback.state) {
        throw new SsoVerificationError('the echoed state was not stored here');
    }
    if (params['code'] !== VALID_CODE) {
        throw new SsoVerificationError('the code signature does not verify');
    }
    if (params['nonce_echo'] !== callback.nonce) {
        throw new SsoVerificationError('the echoed nonce was not stored here');
    }
    return VERIFIED_PROFILE;
}

function stubProvider(behaviour: StubBehaviour): SsoProvider {
    let descriptorCalls = 0;
    return {
        descriptor: () => {
            descriptorCalls += 1;
            return behaviour.descriptor
                ? behaviour.descriptor(descriptorCalls)
                : CONFORMING_DESCRIPTOR;
        },
        authorize: async (request) =>
            behaviour.authorize
                ? behaviour.authorize(request)
                : conformingAuthorize(request),
        complete: async (callback) =>
            behaviour.complete
                ? behaviour.complete(callback)
                : conformingComplete(callback)
    };
}

/** The provider's response, as the core would hand it back to `complete`. */
function callbackWith(overrides: Record<string, string>): SsoCallback {
    return {
        params: {
            code: VALID_CODE,
            state: CORE_SECRETS.state,
            nonce_echo: CORE_SECRETS.nonce,
            ...overrides
        },
        state: CORE_SECRETS.state,
        nonce: CORE_SECRETS.nonce,
        codeVerifier: CORE_SECRETS.codeVerifier,
        redirectUri: CORE_SECRETS.redirectUri
    };
}

/**
 * A case an adapter package would supply, built around a stub that conforms
 * except where `behaviour` breaks it. A fresh provider per scenario, exactly as
 * the kit's own contract promises its factories are called.
 */
function conformanceCase(
    behaviour: StubBehaviour = {}
): SsoProviderConformanceCase {
    const armed = () => stubProvider(behaviour);
    return {
        authorize: () => ({ provider: armed(), request: CORE_SECRETS }),
        happyPath: () => ({ provider: armed(), callback: callbackWith({}) }),
        tampered: () => ({
            provider: armed(),
            callback: callbackWith({ code: 'code-tampered' })
        }),
        mismatchedNonce: () => ({
            provider: armed(),
            callback: callbackWith({ nonce_echo: 'nonce-from-an-old-attempt' })
        }),
        providerError: () => ({
            provider: armed(),
            callback: callbackWith({ error: 'access_denied' })
        })
    };
}

/**
 * The baseline every negative case below is measured against.
 *
 * Without it the failures prove nothing: a kit that reported a sentence for
 * every check would look just as convincing, and the stub could be broken in a
 * way nobody intended.
 */
describe('runSsoProviderConformance — a conforming adapter', () => {
    it.each(SSO_PROVIDER_CONFORMANCE_CHECKS)(
        'passes %s with no finding',
        async (check) => {
            const report = await runSsoProviderConformance(conformanceCase());
            expect(report[check]).toBeNull();
        }
    );
});

/**
 * What the kit is actually for.
 *
 * Every adapter package runs the kit and asserts the whole report is null, so
 * those suites only ever show that the kit *can* pass. These cases arm adapters
 * that are broken in exactly the ways the port's three clauses forbid, and hold
 * the kit to naming the breakage — a kit that silently returned null for a
 * verifier that accepts tampered responses would make every adapter suite in
 * the repo a green light for nothing.
 */
describe('runSsoProviderConformance — findings', () => {
    it('reports a verifier that hands back a profile for a tampered response', async () => {
        const report = await runSsoProviderConformance(
            conformanceCase({ complete: () => VERIFIED_PROFILE })
        );

        expect(report['complete-rejects-a-tampered-response']).toEqual(
            expect.stringContaining('accepted a tampered response')
        );
        // The subject is named, so the finding says whose profile came back.
        expect(report['complete-rejects-a-tampered-response']).toEqual(
            expect.stringContaining(VERIFIED_PROFILE.subject)
        );
    });

    it('reports a verifier that refuses with the wrong error type, naming the type it threw', async () => {
        const report = await runSsoProviderConformance(
            conformanceCase({
                complete: (callback) => {
                    if (callback.params['code'] !== VALID_CODE) {
                        throw new TypeError('cannot read properties of null');
                    }
                    return VERIFIED_PROFILE;
                }
            })
        );

        expect(report['complete-rejects-a-tampered-response']).toEqual(
            expect.stringContaining('TypeError')
        );
        expect(report['complete-rejects-a-tampered-response']).toEqual(
            expect.stringContaining('rather than SsoVerificationError')
        );
        // A refusal is still a refusal: the happy path is untouched by this.
        expect(report['complete-returns-a-usable-profile']).toBeNull();
    });

    it('reports an adapter that puts the PKCE code verifier in the authorization URL', async () => {
        const report = await runSsoProviderConformance(
            conformanceCase({
                authorize: (request) => {
                    const url = new URL('https://idp.example/authorize');
                    url.searchParams.set('state', request.state);
                    url.searchParams.set('code_verifier', request.codeVerifier);
                    return { url: url.toString() };
                }
            })
        );

        expect(report['authorize-never-sends-the-code-verifier']).toEqual(
            expect.stringContaining('PKCE code verifier')
        );
        // Named on its own: the same URL still carries the state correctly.
        expect(report['authorize-carries-the-core-state']).toBeNull();
    });

    it('reports an adapter whose descriptor answers differently on two calls', async () => {
        const report = await runSsoProviderConformance(
            conformanceCase({
                descriptor: (call) => ({
                    kind: 'oidc',
                    label: `Acme SSO (${call})`,
                    callbackMethod: 'GET'
                })
            })
        );

        expect(report['descriptor-is-stable']).toEqual(
            expect.stringContaining('answered differently on two calls')
        );
    });

    it('reports an authorization URL that would cross the network in clear text', async () => {
        const report = await runSsoProviderConformance(
            conformanceCase({
                authorize: (request) => ({
                    url: `http://idp.example/authorize?state=${request.state}`
                })
            })
        );

        expect(report['authorize-returns-an-absolute-url']).toEqual(
            expect.stringContaining('clear text')
        );
    });

    it('reports an authorization target a browser cannot be sent to', async () => {
        const report = await runSsoProviderConformance(
            conformanceCase({
                authorize: (request) => ({
                    url: `/authorize?state=${request.state}`
                })
            })
        );

        expect(report['authorize-returns-an-absolute-url']).toEqual(
            expect.stringContaining('not an absolute URL')
        );
    });

    it('allows plain HTTP on localhost, which is how a contributor runs an IdP', async () => {
        const report = await runSsoProviderConformance(
            conformanceCase({
                authorize: (request) => ({
                    url: `http://localhost:8080/authorize?state=${request.state}`
                })
            })
        );

        expect(report['authorize-returns-an-absolute-url']).toBeNull();
    });
});
