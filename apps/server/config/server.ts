/**
 * Host-level settings that belong to no plugin — how the app sits behind a
 * proxy, and how large a request body it will parse.
 */
import type { TrustProxySetting } from '@orthacms/bootstrap-server';

import { readEnv } from './env';

/**
 * Reads `TRUST_PROXY` into Express's `trust proxy` setting.
 *
 * Three accepted shapes, in the order they are checked: a hop count (`'1'` —
 * the recommended form, and the only one a client cannot forge past), a
 * boolean (`'true'` trusts the entire `X-Forwarded-For` chain, `'false'`
 * trusts none), or any other non-empty string, passed to Express verbatim as a
 * subnet/preset list (`'loopback'`, `'10.0.0.0/8'`). Unset yields `undefined`,
 * leaving Express's default of ignoring forwarded headers entirely.
 *
 * Unset by default: a directly-exposed server must not believe a
 * client-supplied `X-Forwarded-For`. Deployments behind a load balancer set
 * `TRUST_PROXY` to their hop count.
 */
export function trustProxy(): TrustProxySetting | undefined {
    const raw = readEnv('TRUST_PROXY');
    if (!raw) {
        return undefined;
    }
    const hops = Number(raw);
    if (Number.isInteger(hops) && hops >= 0) {
        return hops;
    }
    if (raw === 'true' || raw === 'false') {
        return raw === 'true';
    }
    return raw;
}

/**
 * The largest JSON / urlencoded body a route will accept.
 *
 * Stable tuning, hence a literal, with an env override for a deployment whose
 * entries are larger. 1 MB rather than express's inherited 100 kB default: that
 * ceiling sat below a long-form article with embedded rich text, and it was
 * refused with a bare `413` from the parser — before any controller, guard or
 * protocol layer could shape the answer. Uploads are unrelated and much larger;
 * they are multipart, capped by `plugins.media.maxUploadBytes`.
 */
export function bodyLimit(): string | number {
    return readEnv('MAX_REQUEST_BODY') ?? '1mb';
}
