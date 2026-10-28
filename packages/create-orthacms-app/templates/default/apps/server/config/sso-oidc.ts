// orthacms:if sso-oidc
import type { OidcProviderConfig } from '@orthacms/identity-provider-oidc';
import { oidcFromEnv } from '@orthacms/config';

/**
 * The OpenID Connect provider, or nothing until both `SSO_OIDC_ISSUER` and
 * `SSO_OIDC_CLIENT_ID` are set.
 *
 * The name is what `/api/auth/sso/<name>/start` and every `sso_identities`
 * row refer to, so it is code here: renaming it orphans the links. A button
 * label or extra scopes go beside it (`label: 'Acme staff'`).
 */
export function oidcProvider(): (OidcProviderConfig & { name: string }) | undefined {
    const settings = oidcFromEnv();
    return settings && { name: 'oidc', ...settings };
}
// orthacms:end
