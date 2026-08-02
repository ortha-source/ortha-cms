import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { IdentityPluginConfig } from '../../types';
import { InjectIdentityConfig } from '../../identity.tokens';

/** Name of the opaque session cookie. */
export const SESSION_COOKIE = 'ortha_session';

/**
 * Owns the session cookie's transport concerns so domain services stay free of
 * `req`/`res`. Reads its attributes from config, so call sites never pass them.
 */
@Injectable()
export class CookieService {
    constructor(
        @InjectIdentityConfig() private readonly config: IdentityPluginConfig
    ) {}

    /**
     * Writes the session cookie. Attributes and lifetime come from config
     * (`secure`/`sameSite`/TTL), never literals. The value is the opaque
     * session token; the cookie is unsigned because validity is the
     * per-request DB lookup.
     */
    setSession(res: Response, token: string): void {
        const { session } = this.config;
        res.cookie(SESSION_COOKIE, token, {
            httpOnly: true,
            secure: session.cookieSecure,
            sameSite: session.cookieSameSite,
            maxAge: session.ttlSeconds * 1000,
            path: '/'
        });
    }

    /**
     * Clears the session cookie on logout. Mirrors {@link setSession}'s
     * attributes (`secure`/`sameSite`/`path`) so the browser matches the cookie
     * and drops it; the value is emptied and the expiry pushed to the past.
     */
    clearSession(res: Response): void {
        const { session } = this.config;
        res.clearCookie(SESSION_COOKIE, {
            httpOnly: true,
            secure: session.cookieSecure,
            sameSite: session.cookieSameSite,
            path: '/'
        });
    }

    /**
     * Extracts the session token from the raw `Cookie` header, or `null` when
     * absent. Hand-rolled (no `cookie-parser`) to keep the auth feature
     * self-contained; the auth-guard ticket owns request-side session
     * middleware.
     */
    readSession(req: Request): string | null {
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
}
