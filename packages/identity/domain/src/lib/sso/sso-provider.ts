import type { SsoProfile } from './sso-profile';

/** The protocol an adapter speaks. Decides how its callback arrives. */
export type SsoProviderKind = 'oidc' | 'oauth2' | 'saml';

/**
 * What the sign-in page needs to render a provider's button, and what the
 * router needs to mount its callback.
 *
 * Synchronous and static: this is declared configuration, so the sign-in page
 * renders it without a round trip and the route table is known at boot rather
 * than on the first request.
 */
export interface SsoProviderDescriptor {
    /** The protocol this adapter speaks. */
    kind: SsoProviderKind;
    /** What the button says — "Google", "Acme SSO". Operator-facing text. */
    label: string;
    /**
     * How the identity provider returns the user.
     *
     * `'GET'` for the redirect-response protocols (OIDC, OAuth2); `'POST'` for
     * SAML's HTTP-POST binding, whose response arrives as a form body. It is in
     * the descriptor from the first release precisely so adding SAML is a new
     * package rather than a change to this port.
     */
    callbackMethod: 'GET' | 'POST';
}

/**
 * The one-attempt secrets the **core** minted, handed to the adapter so it can
 * build the authorization URL.
 *
 * Adapters do not generate any of these. CSRF and replay defence is one rule,
 * and implementing it once where it can be tested once beats implementing it in
 * every adapter with a fresh chance to differ — the same call as `resolveModel`
 * living in `copilot-domain` rather than in three model adapters.
 */
export interface SsoAuthorizeRequest {
    /**
     * The absolute callback URL this attempt will return to. Must be byte-identical
     * to the one used at token exchange, because most identity providers bind
     * the authorization code to it.
     */
    redirectUri: string;
    /** Opaque CSRF value, echoed by the provider and re-checked by the core. */
    state: string;
    /** Opaque replay-defence value, bound into the identity token. */
    nonce: string;
    /**
     * The PKCE code verifier. The adapter derives the challenge from it
     * (`S256`); the verifier itself never leaves the server until the token
     * exchange.
     */
    codeVerifier: string;
    /**
     * Extra scopes the deployment asked for beyond the adapter's own defaults.
     * Adapters may ignore what their protocol has no concept of.
     */
    scopes?: readonly string[];
}

/** Where to send the browser to start the handshake. */
export interface SsoAuthorizeRedirect {
    /** Absolute URL. The core sets no cookies of the adapter's choosing. */
    url: string;
}

/**
 * A returning user, as the core received them, plus the secrets it stored for
 * this attempt.
 *
 * The adapter is handed back exactly what it was given in
 * {@link SsoAuthorizeRequest}, so it can check `state`, compare `nonce` against
 * the identity token's claim, and spend `codeVerifier` at the token endpoint —
 * without needing any storage of its own.
 */
export interface SsoCallback {
    /**
     * What the provider returned: the query string for a `GET` callback, the
     * form body for a `POST` one. Untrusted input — every value here is
     * attacker-controllable until the adapter has verified the response.
     */
    params: Readonly<Record<string, string>>;
    /** The `state` the core stored for this attempt. */
    state: string;
    /** The `nonce` the core stored for this attempt. */
    nonce: string;
    /** The PKCE verifier the core stored for this attempt. */
    codeVerifier: string;
    /** The `redirectUri` the core sent at authorization time. */
    redirectUri: string;
}

/** What an adapter needs to build a provider-side logout URL. */
export interface SsoLogoutRequest {
    /** Where the provider should return the user after signing them out. */
    returnTo: string;
    /** The provider session the Ortha session was opened from, if recorded. */
    sessionId?: string | null;
}

/**
 * The identity-provider boundary. Implementations live in separate packages
 * (`@orthacms/identity-provider-oidc`, `@orthacms/identity-provider-fake`, …)
 * and are registered at the composition root. The identity plugin depends only
 * on this interface — never on a protocol library
 * ([ADR-0012](../../../../../../docs/adr/0012-sso-provider-port.md) §1).
 *
 * **Three clauses bind every adapter**, and each is something the core has no
 * way to check for itself:
 *
 * 1. **`complete` verifies, or it throws.** Signature, issuer, audience,
 *    `nonce` and expiry are checked inside the adapter, and any failure raises
 *    {@link SsoVerificationError}. An adapter must never return a profile it
 *    merely decoded — from the outside, a decoded profile and a verified one
 *    are the same object.
 * 2. **{@link SsoProfile.subject} is stable, issuer-scoped, and never the
 *    email.** The link table keys on it.
 * 3. **{@link SsoProfile.emailVerified} reports what the provider claimed**,
 *    rather than a convenient default. It is the only gate on claiming an
 *    account that already exists.
 */
export interface SsoProvider {
    /** Static description — the button, the protocol, the callback method. */
    descriptor(): SsoProviderDescriptor;
    /**
     * Builds the URL that starts the handshake, from the secrets the core
     * minted. Async because an adapter may need a discovery document it has not
     * fetched yet.
     */
    authorize(request: SsoAuthorizeRequest): Promise<SsoAuthorizeRedirect>;
    /**
     * Turns a provider's callback into a verified profile.
     *
     * @throws SsoVerificationError for every rejection — a bad signature, a
     *   mismatched `nonce`, an expired assertion, a provider-side error code.
     *   One error type, because the caller renders one generic failure either
     *   way and a differentiated one would describe the CMS's internals to an
     *   anonymous caller.
     */
    complete(callback: SsoCallback): Promise<SsoProfile>;
    /**
     * The provider's own sign-out URL, when it supports RP-initiated logout.
     * `null` when it does not, which is the common case and not an error.
     */
    logoutUrl?(request: SsoLogoutRequest): string | null;
}

/** One registered backend: an operator-chosen name plus a built adapter. */
export interface SsoRegistration {
    /**
     * The name this provider is addressed by — in the route
     * (`/api/auth/sso/:provider/start`), in the link table's `provider` column,
     * and in a role-mapping handler. Stable: changing it orphans every link row
     * that names it.
     */
    name: string;
    /** The adapter itself, already constructed at the composition root. */
    provider: SsoProvider;
}

/** One entry of the list the sign-in page renders. */
export interface SsoProviderSummary {
    /** The registered name — what `/start` is called with. */
    name: string;
    /** The button label. */
    label: string;
    /** The protocol, so the client can tell a redirect flow from a POST one. */
    kind: SsoProviderKind;
}

/** The named providers a deployment offers, resolved by name. */
export interface SsoRegistry {
    /** Resolves a provider by name; throws if the name is not registered. */
    get(name: string): SsoProvider;
    /** Whether a provider is registered under `name`. */
    has(name: string): boolean;
    /** Every registered name, in registration order. */
    names(): string[];
    /**
     * What the sign-in page renders, in registration order. Unlike the copilot's
     * model catalogue there is no "first is the default" rule here: the person
     * picks a button, so order is presentation only.
     */
    catalogue(): SsoProviderSummary[];
}

/** DI token the composition root binds to the {@link SsoRegistry}. */
export const SSO_REGISTRY = Symbol('SSO_REGISTRY');
