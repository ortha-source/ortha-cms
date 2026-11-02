import { defined, readEnv, readFlag, readList } from '@orthacms/utils-server';

import { apiPublicUrl, publicUrl } from './urls';

/**
 * What the environment says about an OpenID Connect provider. The name, label
 * and scopes are code: the name is what every `sso_identities` row refers to,
 * and renaming it orphans the links.
 */
export interface OidcSettings {
    issuer: string;
    clientId: string;
    clientSecret?: string;
    emailVerifiedWhenAbsent: boolean;
}

/**
 * The OpenID Connect provider, or `undefined` unless both the issuer and the
 * client id are set — an issuer with no client is a sign-in button that can
 * only fail, and every SSO failure deliberately looks the same.
 */
export function oidcFromEnv(): OidcSettings | undefined {
    const issuer = readEnv('SSO_OIDC_ISSUER');
    const clientId = readEnv('SSO_OIDC_CLIENT_ID');
    if (!issuer || !clientId) {
        return undefined;
    }
    return defined({
        issuer,
        clientId,
        clientSecret: readEnv('SSO_OIDC_CLIENT_SECRET'),
        emailVerifiedWhenAbsent: readFlag(
            'SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT',
            false
        )
    });
}

/** What the environment says about the GitHub provider. */
export interface GithubSettings {
    clientId: string;
    clientSecret: string;
    enterpriseBaseUrl?: string;
}

/**
 * The GitHub provider, or `undefined` unless both credentials are set. The
 * secret is not optional: GitHub has no PKCE, so it is the only thing proving
 * the code is redeemed by this application.
 */
export function githubFromEnv(): GithubSettings | undefined {
    const clientId = readEnv('SSO_GITHUB_CLIENT_ID');
    const clientSecret = readEnv('SSO_GITHUB_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
        return undefined;
    }
    return defined({
        clientId,
        clientSecret,
        enterpriseBaseUrl: readEnv('SSO_GITHUB_ENTERPRISE_URL')
    });
}

/** What the environment says about a SAML 2.0 provider. */
export interface SamlSettings {
    entryPoint: string;
    idpCert: string;
    issuer: string;
    subjectAttribute?: string;
    emailVerified: boolean;
}

/**
 * The SAML provider, or `undefined` unless the entry point and the certificate
 * are set. SAML has no discovery document: the certificate is the whole trust
 * relationship.
 */
export function samlFromEnv(): SamlSettings | undefined {
    const entryPoint = readEnv('SSO_SAML_ENTRY_POINT');
    const idpCert = readEnv('SSO_SAML_IDP_CERT');
    if (!entryPoint || !idpCert) {
        return undefined;
    }
    const issuer = readEnv('SSO_SAML_ISSUER') ?? apiPublicUrl() ?? publicUrl();
    if (!issuer) {
        throw new Error(
            'SAML is configured but has no entity id: set SSO_SAML_ISSUER, or PUBLIC_URL for it to default to.'
        );
    }
    return defined({
        entryPoint,
        // An environment variable cannot hold real newlines, so a PEM arrives
        // with `\n` escapes; the XML signature check needs them back.
        idpCert: idpCert.replace(/\\n/g, '\n'),
        issuer,
        subjectAttribute: readEnv('SSO_SAML_SUBJECT_ATTRIBUTE'),
        emailVerified: readFlag('SSO_SAML_EMAIL_VERIFIED', false)
    });
}

/** The identity plugin's `sso` block, as the environment gives it. */
export interface SsoSettings {
    publicBaseUrl?: string;
    provisioning?: { domains: string[]; defaultRole: string };
    allowPasswordLogin: boolean;
}

/**
 * Who single sign-on lets in, and where its callbacks are built from.
 *
 * Provisioning needs a domain list on purpose: an identity provider answers
 * for everyone it knows, and a public one knows everyone. Without one, SSO
 * signs in existing accounts only.
 */
export function ssoFromEnv(): SsoSettings {
    const domains = readEnv('SSO_PROVISION_DOMAINS');
    return defined({
        publicBaseUrl: apiPublicUrl(),
        provisioning: domains
            ? {
                  domains: readList('SSO_PROVISION_DOMAINS', ''),
                  defaultRole: readEnv('SSO_PROVISION_ROLE') ?? 'viewer'
              }
            : undefined,
        allowPasswordLogin: readFlag('SSO_ALLOW_PASSWORD_LOGIN', true)
    });
}
