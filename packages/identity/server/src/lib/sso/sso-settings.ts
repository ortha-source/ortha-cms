import type { IdentityPluginConfig } from '../types';

/**
 * How long a sign-in attempt stays live when the host names no TTL.
 *
 * Ten minutes: long enough for a consent screen, a password manager and a
 * second factor; short enough that an attempt left open in a forgotten tab is
 * not a credential sitting around for the afternoon.
 */
export const DEFAULT_SSO_REQUEST_TTL_SECONDS = 600;

/** The configured attempt lifetime, or the default above. */
export function ssoRequestTtlSeconds(config: IdentityPluginConfig): number {
    return config.sso?.requestTtlSeconds ?? DEFAULT_SSO_REQUEST_TTL_SECONDS;
}

/**
 * The origin the browser reaches this API on.
 *
 * Configured rather than derived from the request's `Host` header, which a
 * client controls: a forged `Host` would otherwise be echoed into the
 * `redirect_uri` an identity provider is asked to return to.
 *
 * Falls back to the **first allowed origin**, which is right far more often
 * than it looks. `allowedOrigins` names the admin app, and the admin reaches
 * `/api` through its own origin — Vite proxies it in development, and a
 * deployment serves both from one host. A split-origin deployment sets
 * `publicBaseUrl` explicitly.
 */
export function ssoPublicBaseUrl(config: IdentityPluginConfig): string {
    const configured = config.sso?.publicBaseUrl?.trim();
    const base = configured || config.allowedOrigins[0];
    if (!base) {
        throw new Error(
            'SSO needs to know the URL browsers reach this API on. Set `plugins.identity.sso.publicBaseUrl`, or list the admin origin in `allowedOrigins`.'
        );
    }
    return base.replace(/\/+$/, '');
}

/**
 * The absolute callback URL for one provider — what is registered with the
 * identity provider, and what is sent as `redirect_uri` at both the
 * authorization and the token exchange.
 *
 * Built in one place because most providers bind the authorization code to this
 * exact string: two spellings that differ by a trailing slash are two different
 * URLs to them, and the failure surfaces at the token exchange as a flat
 * `invalid_grant` with nothing pointing at the cause.
 */
export function ssoCallbackUrl(
    config: IdentityPluginConfig,
    provider: string
): string {
    const prefix = config.sso?.apiPathPrefix ?? '/api';
    return `${ssoPublicBaseUrl(config)}${prefix}/auth/sso/${provider}/callback`;
}

/**
 * Where to send a browser whose sign-in did not work out.
 *
 * The admin's own sign-in screen, with a flag it renders as an explanation. A
 * bare 401 would be technically honest and useless: the person is mid-redirect
 * from a third party, and what they need is the page they started on, saying
 * what happened.
 */
export function ssoFailureUrl(config: IdentityPluginConfig): string {
    const path = config.sso?.signInPath ?? '/identity/signin';
    return `${ssoPublicBaseUrl(config)}${path}?error=sso`;
}

/** The absolute URL a successful sign-in lands on. */
export function ssoSuccessUrl(
    config: IdentityPluginConfig,
    redirectTo: string
): string {
    return `${ssoPublicBaseUrl(config)}${redirectTo}`;
}
