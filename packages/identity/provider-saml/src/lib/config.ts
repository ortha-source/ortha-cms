/** How one SAML identity provider is reached and read. */
export interface SamlProviderConfig {
    /** The IdP's single-sign-on URL — where the AuthnRequest is sent. */
    entryPoint: string;
    /**
     * The IdP's signing certificate(s), PEM or bare base64. Several may be
     * given so a certificate rollover does not need a redeploy timed to the
     * minute.
     *
     * There is no discovery here and no JWKS: SAML trust is a certificate an
     * operator copies from their IdP, which is why it is required and why a
     * rollover is a configuration change rather than something the adapter can
     * pick up on its own.
     */
    idpCert: string | string[];
    /**
     * This CMS's entity id — the `Issuer` on the AuthnRequest, and what the IdP
     * has registered as the service provider.
     */
    issuer: string;
    /** Button text. Defaults to `SAML`. */
    label?: string;
    /**
     * The attribute holding a **stable** identifier for the person, when the
     * `NameID` is not one.
     *
     * Worth setting whenever the IdP's NameID format is `emailAddress`: an
     * address is not a stable identifier, and the core refuses a profile whose
     * subject is one. Point this at an immutable directory id instead.
     */
    subjectAttribute?: string;
    /**
     * The attribute holding the email address. Defaults to trying the usual
     * spellings, which differ per IdP more than anything else in SAML does.
     */
    emailAttribute?: string;
    /** The attribute holding group membership, when a deployment maps roles. */
    groupsAttribute?: string;
    /** The attribute holding a display name. */
    nameAttribute?: string;
    /**
     * Whether an address this IdP asserts counts as **verified**.
     *
     * Defaults to `false`, and this is the setting most likely to be reached
     * for. **SAML has no verification claim at all** — no assertion carries the
     * equivalent of `email_verified`, so there is nothing an adapter could read
     * and be honest about. Setting this is an operator asserting that their
     * directory is authoritative for the addresses it reports, which is usually
     * true of a corporate IdP and is still not something to assume on their
     * behalf: it is the only gate on a first sign-in claiming an existing
     * account.
     */
    emailVerified?: boolean;
    /** The SP private key, when the IdP requires signed AuthnRequests. */
    privateKey?: string;
    /** The SP certificate that goes with {@link privateKey}. */
    signingCert?: string;
    /** Whether to require the IdP to sign its assertions. Defaults to `true`. */
    wantAssertionsSigned?: boolean;
    /** Whether to require a signed response envelope. Defaults to `true`. */
    wantAuthnResponseSigned?: boolean;
    /** Accepted clock skew, in seconds. Defaults to 60. */
    clockToleranceSeconds?: number;
}

/** Defaults applied once, so no code path has to remember them. */
export interface ResolvedSamlConfig extends SamlProviderConfig {
    label: string;
    emailVerified: boolean;
    wantAssertionsSigned: boolean;
    wantAuthnResponseSigned: boolean;
    clockToleranceSeconds: number;
}

/** The attributes an email is read from, in order, when none is configured. */
export const DEFAULT_EMAIL_ATTRIBUTES = [
    'email',
    'mail',
    'urn:oid:0.9.2342.19200300.100.1.3',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
] as const;

/** The attributes a display name is read from, when none is configured. */
export const DEFAULT_NAME_ATTRIBUTES = [
    'displayName',
    'cn',
    'name',
    'http://schemas.microsoft.com/identity/claims/displayname'
] as const;

/**
 * Applies the defaults and rejects a configuration that cannot work.
 *
 * Eager, at construction, because every SSO failure looks identical by design:
 * a missing certificate would otherwise reach an operator as the same blank
 * "that sign-in did not complete" as a cancelled consent screen.
 */
export function resolveSamlConfig(
    config: SamlProviderConfig
): ResolvedSamlConfig {
    let entry: URL;
    try {
        entry = new URL(config.entryPoint);
    } catch {
        throw new Error(
            `createSamlProvider needs an absolute entryPoint URL; got "${config.entryPoint}".`
        );
    }
    if (entry.protocol !== 'https:' && entry.hostname !== 'localhost') {
        throw new Error(
            `createSamlProvider refuses the non-HTTPS entryPoint "${config.entryPoint}": the assertion would cross the network in clear text. Only localhost is exempt, for development.`
        );
    }
    if (!config.issuer.trim()) {
        throw new Error(
            'createSamlProvider needs an issuer — the entity id your identity provider has registered for this application.'
        );
    }
    const certs = Array.isArray(config.idpCert)
        ? config.idpCert
        : [config.idpCert];
    if (certs.length === 0 || certs.some((cert) => !cert?.trim())) {
        throw new Error(
            "createSamlProvider needs the identity provider's signing certificate. SAML has no discovery document and no key endpoint — the certificate is the whole of the trust relationship, so there is nothing to fall back to."
        );
    }
    if (config.privateKey && !config.signingCert) {
        throw new Error(
            'createSamlProvider was given a privateKey with no signingCert. An identity provider validates a signed AuthnRequest against the certificate you registered with it, so the pair has to travel together.'
        );
    }

    return {
        ...config,
        label: config.label ?? 'SAML',
        // Never defaulted to true. See the field's own note: there is no claim
        // to read, so `true` can only ever be an operator's assertion.
        emailVerified: config.emailVerified ?? false,
        wantAssertionsSigned: config.wantAssertionsSigned ?? true,
        wantAuthnResponseSigned: config.wantAuthnResponseSigned ?? true,
        clockToleranceSeconds: config.clockToleranceSeconds ?? 60
    };
}
