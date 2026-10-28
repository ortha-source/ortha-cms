// orthacms:if sso-saml
import type { SamlProviderConfig } from '@orthacms/identity-provider-saml';
import { samlFromEnv } from '@orthacms/config';

/**
 * The SAML provider, or nothing until the entry point and the certificate are
 * set. SAML has no discovery document: the certificate is the whole trust
 * relationship. The entity id defaults to `PUBLIC_URL`.
 *
 * Attribute names, when your IdP does not send the usual spellings, are code:
 * `emailAttribute`, `nameAttribute`, `groupsAttribute` beside the name.
 */
export function samlProvider():
    | (SamlProviderConfig & { name: string })
    | undefined {
    const settings = samlFromEnv();
    return settings && { name: 'saml', ...settings };
}
// orthacms:end
