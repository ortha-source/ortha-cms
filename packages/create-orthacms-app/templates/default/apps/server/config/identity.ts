/** Identity — sessions, tokens, the SSO handshake, and the first admin. */
import type { IdentityPluginConfig } from '@orthacms/identity-server';
// orthacms:if sso-oidc
import type { OidcProviderConfig } from '@orthacms/identity-provider-oidc';
// orthacms:end
// orthacms:if sso-github
import type { GithubProviderConfig } from '@orthacms/identity-provider-github';
// orthacms:end
// orthacms:if sso-saml
import type { SamlProviderConfig } from '@orthacms/identity-provider-saml';
// orthacms:end
import { allowedOrigins, rootAdminFromEnv, ssoFromEnv } from '@orthacms/config';
import { defined, isProduction } from '@orthacms/utils-server';

// orthacms:if sso-oidc
import { oidcProvider } from './sso-oidc';
// orthacms:end
// orthacms:if sso-github
import { githubProvider } from './sso-github';
// orthacms:end
// orthacms:if sso-saml
import { samlProvider } from './sso-saml';
// orthacms:end

/**
 * Identity settings, plus the identity providers this app can reach.
 *
 * The provider settings live here rather than inside `IdentityPluginConfig`,
 * for the same reason the copilot's backends do: the plugin names no protocol,
 * and this file is the one place that reads the environment. The constructed
 * adapters are registered in `src/plugins.ts`.
 */
export interface AppIdentityConfig extends IdentityPluginConfig {
    /**
     * Identity providers, keyed by the name they are registered under. That
     * name appears in the sign-in URL and in every `sso_identities` row, so
     * renaming one orphans the links that name it.
     *
     * Optional, and absent unless this app was generated with single sign-on.
     */
    ssoProviders?: {
        // orthacms:if sso-oidc
        /** A generic OpenID Connect provider. Present when both env vars are set. */
        oidc?: OidcProviderConfig & { name: string };
        // orthacms:end
        // orthacms:if sso-github
        /** GitHub or GitHub Enterprise Server. Present when both env vars are set. */
        github?: GithubProviderConfig & { name: string };
        // orthacms:end
        // orthacms:if sso-saml
        /** A SAML 2.0 identity provider. Present when the entry point and certificate are set. */
        saml?: SamlProviderConfig & { name: string };
        // orthacms:end
    };
}

/** Identity — sessions, tokens, the SSO handshake, and the first admin. */
export function identityConfig(): AppIdentityConfig {
    return {
        // Origins allowed to sign in and make changes (login-CSRF defence).
        // `PUBLIC_URL`'s origin, then `EXTRA_ORIGINS`, then — outside
        // production — the dev server and `PORT`, which is where `npm start`
        // serves the admin. A browser sends `Origin` on every POST, same-origin
        // included. Production without `PUBLIC_URL` refuses to start.
        allowedOrigins: allowedOrigins(),
        // Lifetimes and the login rate limit are code: a value set by accident
        // in the environment would be a security setting changed in silence.
        session: {
            ttlSeconds: 60 * 60 * 24 * 7,
            cookieSecure: isProduction(),
            cookieSameSite: 'lax' as const
        },
        token: {
            inviteTtlSeconds: 60 * 60 * 24 * 7,
            resetTtlSeconds: 60 * 60
        },
        rateLimit: {
            ttlSeconds: 60,
            limit: 10
        },
        sso: ssoConfig(),
        // orthacms:if sso
        ssoProviders: defined({
            // orthacms:if sso-oidc
            oidc: oidcProvider(),
            // orthacms:end
            // orthacms:if sso-github
            github: githubProvider(),
            // orthacms:end
            // orthacms:if sso-saml
            saml: samlProvider()
            // orthacms:end
        }),
        // orthacms:end
        // With `ORTHACMS_ROOT_ADMIN_EMAIL` set, an admin is provisioned on boot —
        // idempotent and non-destructive. A password of spaces is nothing, not
        // a password.
        rootAdmin: rootAdminFromEnv()
    };
}

/**
 * The shape of the single sign-on handshake. The providers themselves are
 * constructed in `src/plugins.ts`; these settings say how the round trip runs.
 */
function ssoConfig(): NonNullable<IdentityPluginConfig['sso']> {
    return defined({
        // Where SSO callbacks are built from (`API_PUBLIC_URL`, else the first
        // allowed origin), who single sign-on may create an account for
        // (`SSO_PROVISION_DOMAINS`), and whether passwords still work.
        ...ssoFromEnv(),
        // How long one sign-in attempt stays live, in seconds.
        requestTtlSeconds: 600
    });
}
