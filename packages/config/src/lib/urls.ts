import {
    isProduction,
    readEnv,
    readList,
    readOptionalList,
    readPositiveInt
} from '@orthacms/utils-server';

import { warnOnce } from './warn';

/**
 * An absolute http(s) URL, without a trailing slash, or a refusal naming the
 * variable. A URL with no scheme (`cms.example.com`) parses as a relative path
 * in some places and a host in others; refusing it at boot is cheaper than
 * finding out from an invitation link.
 */
export function absoluteUrl(name: string, raw: string): string {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error(
            `${name} must be an absolute URL such as https://cms.example.com (got "${raw}").`
        );
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(
            `${name} must start with http:// or https:// (got "${raw}").`
        );
    }
    return url.href.replace(/\/+$/, '');
}

/** The admin dev server's address, which is what development opens. */
function devAdminUrl(): string {
    return `http://localhost:${readPositiveInt('ADMIN_PORT', 4200)}`;
}

/**
 * The address people open the admin on (`PUBLIC_URL`).
 *
 * Outside production it defaults to the admin dev server. In production it
 * has no default — `undefined` here — because every guess (localhost, the
 * request's `Host`) is wrong somewhere: the callers that need it refuse to
 * start with the variable named.
 */
export function publicUrl(): string | undefined {
    const raw = readEnv('PUBLIC_URL');
    if (raw) {
        return absoluteUrl('PUBLIC_URL', raw);
    }
    return isProduction() ? undefined : devAdminUrl();
}

/**
 * `PUBLIC_URL`, or a refusal saying what needs it. For the callers that cannot
 * do without: building links in an email, the allowed origin in production.
 */
export function requirePublicUrl(reason: string): string {
    const url = publicUrl();
    if (!url) {
        throw new Error(
            `Missing required environment variable PUBLIC_URL — ${reason}. ` +
                'Set it to the address people open the admin on, e.g. https://cms.example.com.'
        );
    }
    return url;
}

/**
 * The address browsers reach the API on (`API_PUBLIC_URL`), only when it
 * differs from `PUBLIC_URL`. SSO builds its callback URLs from it and falls
 * back to the first allowed origin, which is `PUBLIC_URL`.
 */
export function apiPublicUrl(): string | undefined {
    const raw = readEnv('API_PUBLIC_URL');
    return raw ? absoluteUrl('API_PUBLIC_URL', raw) : undefined;
}

/**
 * The origins allowed to sign in and make changes.
 *
 * `PUBLIC_URL`'s origin first — SSO falls back to the first entry — then
 * `EXTRA_ORIGINS`, then, outside production, the admin dev server and the
 * server's own port, which is where `npm start` serves the admin. A browser
 * sends `Origin` on every POST, same-origin included, so leaving the second
 * one off answered every local sign-in with a 403.
 *
 * `ALLOWED_ORIGINS` is still honoured, verbatim and with a warning, so a
 * deployment that set it keeps working on upgrade.
 */
export function allowedOrigins(): string[] {
    if (readEnv('ALLOWED_ORIGINS')) {
        warnOnce(
            'ALLOWED_ORIGINS',
            'ALLOWED_ORIGINS is still read, but PUBLIC_URL (plus EXTRA_ORIGINS for any other address) replaces it — move the value before the next release.'
        );
        return readList('ALLOWED_ORIGINS', '');
    }
    const origins = new Set<string>();
    const url = isProduction()
        ? requirePublicUrl(
              'in production it is the only origin sign-in accepts'
          )
        : publicUrl();
    if (url) {
        origins.add(new URL(url).origin);
    }
    for (const extra of readOptionalList('EXTRA_ORIGINS') ?? []) {
        origins.add(new URL(absoluteUrl('EXTRA_ORIGINS', extra)).origin);
    }
    if (!isProduction()) {
        origins.add(devAdminUrl());
        origins.add(`http://localhost:${readPositiveInt('PORT', 3000)}`);
    }
    return [...origins];
}
