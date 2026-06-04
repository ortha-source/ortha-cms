import type { Request, Response } from 'express';
import type { IdentitySessionConfig } from '../types';

/** Name of the opaque session cookie; shared by the login and me controllers. */
export const SESSION_COOKIE = 'ortha_session';

/**
 * Writes the session cookie. Attributes and lifetime come from config
 * (`secure`/`sameSite`/TTL), never literals. The value is the opaque session
 * id; the cookie is unsigned because validity is the per-request DB lookup.
 */
export function setSessionCookie(
    res: Response,
    sessionId: string,
    config: IdentitySessionConfig
): void {
    res.cookie(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        maxAge: config.ttlSeconds * 1000,
        path: '/'
    });
}

/**
 * Extracts the session token from the raw `Cookie` header, or `null` when
 * absent. Hand-rolled (no `cookie-parser`) to keep the auth feature
 * self-contained; the auth-guard ticket owns request-side session middleware.
 */
export function readSessionCookie(req: Request): string | null {
    const header = req.headers.cookie;
    if (!header) {
        return null;
    }
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) {
            continue;
        }
        if (part.slice(0, eq).trim() === SESSION_COOKIE) {
            return part.slice(eq + 1).trim() || null;
        }
    }
    return null;
}
