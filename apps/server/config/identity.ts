/** Identity — sessions, tokens, the SSO handshake, and the SSO providers. */
import type { IdentityPluginConfig } from '@orthacms/identity-server';
import type { OidcProviderConfig } from '@orthacms/identity-provider-oidc';
import type { GithubProviderConfig } from '@orthacms/identity-provider-github';
import type { SamlProviderConfig } from '@orthacms/identity-provider-saml';

import {
    allowedOrigins,
    githubFromEnv,
    oidcFromEnv,
    rootAdminFromEnv,
    samlFromEnv,
    ssoFromEnv
} from '@orthacms/config';
import { defined } from '@orthacms/utils-server';

import { isProduction } from './env';

/**
 * Identity settings, plus the connection settings for the identity providers
 * this deployment can reach.
 *
 * The provider settings live **here**, not inside `IdentityPluginConfig`: the
 * plugin is adapter-agnostic by decision (ADR-0013 §1), so it names no
 * protocol. `plugins.ts` already imports the adapter factories, so importing
 * their config type costs no new coupling — and adding a second identity
 * provider is a key here plus a line there, with nothing to change inside the
 * identity packages.
 *
 * A key is present only when the deployment configured that provider, exactly
 * as the copilot's backends are. A half-configured provider is worse than an
 * absent one: it appears on the sign-in page as a button that can only fail,
 * and every SSO failure deliberately looks the same, so the person clicking it
 * learns nothing.
 */
export interface OrthaCmsIdentityConfig extends IdentityPluginConfig {
    /**
     * Identity providers, keyed by the name they are registered under. That
     * name appears in the sign-in URL and in every `sso_identities` row, so
     * changing it orphans the links that name it.
     */
    ssoProviders: {
        /**
         * A generic OpenID Connect provider — Okta, Auth0, Keycloak, Google,
         * Entra ID, Authentik, Zitadel and the rest all speak it. Present when
         * `SSO_OIDC_ISSUER` and `SSO_OIDC_CLIENT_ID` are both set.
         *
         * Registered as `oidc`. To run
         * two at once — a staff directory and a contractor one — copy this key
         * and the matching line in `plugins.ts`; the adapter takes its whole
         * configuration as an argument, so nothing else changes.
         */
        oidc?: OidcProviderConfig & { name: string };
        /**
         * GitHub or GitHub Enterprise Server. Its own key because GitHub is
         * OAuth2, not OIDC — there is no identity token, so it is a different
         * adapter rather than a preset. Present when both credentials are set.
         */
        github?: GithubProviderConfig & { name: string };
        /**
         * A SAML 2.0 identity provider. Present when the entry point and the
         * signing certificate are both set — SAML has no discovery document, so
         * the certificate is the whole of the trust relationship and there is
         * nothing to fall back to.
         */
        saml?: SamlProviderConfig & { name: string };
    };
}

/** Identity — sessions, tokens, the SSO handshake, and the SSO providers. */
export function identityConfig(): OrthaCmsIdentityConfig {
    const sso = ssoFromEnv();
    const oidc = oidcFromEnv();
    const github = githubFromEnv();
    const saml = samlFromEnv();
    return {
        // `PUBLIC_URL`'s origin first (SSO falls back to it), then
        // `EXTRA_ORIGINS`, then — outside production — the dev server and
        // `PORT`. Production without `PUBLIC_URL` refuses to load.
        allowedOrigins: allowedOrigins(),
        // Lifetimes and the login rate limit are code, not environment: no
        // deployment needed to vary them per environment, and a value set by
        // accident is a security setting changed in silence.
        session: {
            ttlSeconds: 60 * 60 * 24 * 7,
            cookieSecure: isProduction,
            cookieSameSite: 'lax'
        },
        token: {
            inviteTtlSeconds: 60 * 60 * 24 * 7,
            resetTtlSeconds: 60 * 60
        },
        rateLimit: { ttlSeconds: 60, limit: 10 },
        // Read through `readEnv`, so a password of three spaces is nothing
        // rather than a password — blank, it trips
        // `MissingRootAdminPasswordError`, which names the account.
        rootAdmin: rootAdminFromEnv(),
        sso: {
            ...sso,
            requestTtlSeconds: 600
            // `sessionTtlSeconds` shortens sessions opened through an identity
            // provider — worth setting for one with no back-channel logout.
        },
        ssoProviders: defined({
            // The name is what `/api/auth/sso/<name>/start` and every
            // `sso_identities` row refer to: renaming one orphans its links.
            // A button label or wider scopes go beside it, in code.
            oidc: oidc && { name: 'oidc', ...oidc },
            github: github && { name: 'github', ...github },
            saml: saml && { name: 'saml', ...saml }
        })
    };
}
