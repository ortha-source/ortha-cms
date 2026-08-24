/** The endpoints an adapter needs, when discovery is unavailable or overridden. */
export interface OidcEndpoints {
    /** Where the browser is sent to authorize. */
    authorization: string;
    /** Where the authorization code is exchanged. */
    token: string;
    /** Where the signing keys are published. */
    jwks: string;
    /** RP-initiated logout, when the provider offers one. */
    endSession?: string;
}

/** How one OIDC identity provider is reached and read. */
export interface OidcProviderConfig {
    /**
     * The issuer, exactly as it appears in the `iss` claim — e.g.
     * `https://accounts.google.com`. Discovery is fetched from
     * `<issuer>/.well-known/openid-configuration`, and every identity token is
     * verified against this value.
     *
     * It is compared byte for byte, because that is what the check is worth:
     * an issuer that "looks right" is exactly what a malicious token supplies.
     */
    issuer: string;
    /** The client id registered with the provider. */
    clientId: string;
    /**
     * The client secret, when the provider issued one.
     *
     * Optional because PKCE makes a public client viable, and some
     * deployments prefer one. When present it is sent with HTTP Basic
     * (`client_secret_basic`), which the spec prefers and every provider here
     * accepts.
     */
    clientSecret?: string;
    /** Button text on the sign-in page. Defaults to the issuer's host. */
    label?: string;
    /**
     * Scopes to request. Defaults to `openid profile email` — `openid` is
     * mandatory, and without `email` there is nothing to match an account on.
     */
    scopes?: readonly string[];
    /**
     * Extra authorization parameters, verbatim. This is where a provider's own
     * knobs go: Google's `hd` to pin a hosted domain, `prompt=select_account`,
     * Okta's `idp`. Reserved protocol parameters cannot be overridden here.
     */
    authorizationParams?: Readonly<Record<string, string>>;
    /**
     * Endpoints to use instead of discovery. Supply all three to skip the
     * discovery request entirely — useful for a provider behind a network
     * whose discovery document is not reachable from the CMS.
     */
    endpoints?: OidcEndpoints;
    /**
     * The claim carrying group membership, when the deployment maps groups to
     * roles. Unset means groups are not read at all — the CMS should not
     * collect a claim nobody asked it to use.
     */
    groupsClaim?: string;
    /**
     * The claim to read the email from, in order of preference. Defaults to
     * `email`, then `preferred_username`, then `upn` — the three spellings
     * that cover the shipped presets.
     */
    emailClaims?: readonly string[];
    /**
     * Whether to treat an address as verified when the provider sends **no**
     * `email_verified` claim at all.
     *
     * Defaults to `false`, and the default is the safe one: `emailVerified` is
     * the only gate on a first sign-in claiming an existing account, so
     * inventing a `true` would turn "sign in with your work account" into "sign
     * in with any account that types the right address".
     *
     * Some providers — Microsoft Entra ID most notably — simply never emit the
     * claim. Setting this is an operator asserting that *this* directory is
     * authoritative for the addresses it reports. That assertion may be
     * perfectly true; it is just not something an adapter may make on the
     * operator's behalf. A provider that sends `email_verified: false` is
     * always taken at its word, whatever this is set to.
     */
    emailVerifiedWhenAbsent?: boolean;
    /**
     * How long a discovery document is reused, in milliseconds. Defaults to one
     * hour. Signing keys are cached separately and refetched on an unknown
     * `kid`, so this only bounds how stale an *endpoint* can be.
     */
    discoveryCacheMs?: number;
    /**
     * Accepted clock skew when checking `exp` and `iat`, in seconds. Defaults
     * to 60.
     *
     * Small on purpose. Some tolerance is necessary — two machines are never
     * exactly in step — but a generous one silently extends the life of every
     * token the provider issues, which is the opposite of what these claims are
     * for.
     */
    clockToleranceSeconds?: number;
    /**
     * The `fetch` used for discovery and the token exchange. Injected so a test
     * can drive the adapter with no network; production leaves it unset and
     * gets the platform's.
     */
    fetch?: typeof globalThis.fetch;
}

/** Defaults applied once, so no code path has to remember them. */
export interface ResolvedOidcConfig extends OidcProviderConfig {
    label: string;
    scopes: readonly string[];
    emailClaims: readonly string[];
    emailVerifiedWhenAbsent: boolean;
    discoveryCacheMs: number;
    clockToleranceSeconds: number;
    fetch: typeof globalThis.fetch;
}

/** The scopes requested when a deployment names none. */
export const DEFAULT_SCOPES = ['openid', 'profile', 'email'] as const;

/** The claims an email is read from, in order, when a deployment names none. */
export const DEFAULT_EMAIL_CLAIMS = [
    'email',
    'preferred_username',
    'upn'
] as const;

/**
 * Applies the defaults and rejects a configuration that cannot work.
 *
 * Eager, at construction, like `CopilotPlugin`'s option check: an issuer that
 * is not a URL or a missing client id would otherwise surface as a failed
 * sign-in — and every failed SSO sign-in looks identical to every other, by
 * design, so the one error a person sees would say nothing about the typo that
 * caused it.
 */
export function resolveOidcConfig(
    config: OidcProviderConfig
): ResolvedOidcConfig {
    let issuerUrl: URL;
    try {
        issuerUrl = new URL(config.issuer);
    } catch {
        throw new Error(
            `createOidcProvider needs an absolute issuer URL; got "${config.issuer}".`
        );
    }
    if (issuerUrl.protocol !== 'https:' && issuerUrl.hostname !== 'localhost') {
        throw new Error(
            `createOidcProvider refuses the non-HTTPS issuer "${config.issuer}": identity tokens and the client secret would cross the network in clear text. Only localhost is exempt, for development.`
        );
    }
    if (!config.clientId.trim()) {
        throw new Error(
            'createOidcProvider needs a clientId — it is how the provider knows which application is asking.'
        );
    }
    const scopes = config.scopes ?? DEFAULT_SCOPES;
    if (!scopes.includes('openid')) {
        throw new Error(
            `createOidcProvider needs the "openid" scope — without it the provider returns no identity token, and there is nothing to verify. Got: ${scopes.join(' ')}.`
        );
    }

    return {
        ...config,
        label: config.label ?? issuerUrl.hostname,
        scopes,
        emailClaims: config.emailClaims ?? DEFAULT_EMAIL_CLAIMS,
        emailVerifiedWhenAbsent: config.emailVerifiedWhenAbsent ?? false,
        discoveryCacheMs: config.discoveryCacheMs ?? 3_600_000,
        clockToleranceSeconds: config.clockToleranceSeconds ?? 60,
        fetch: config.fetch ?? globalThis.fetch
    };
}
