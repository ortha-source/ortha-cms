/**
 * Host-level settings that belong to no plugin — how the app sits behind a
 * proxy, and how large a request body it will parse.
 */
import type { TrustProxySetting } from '@orthacms/bootstrap-server';

import { trustProxy as readTrustProxy } from '@orthacms/config';

/**
 * `TRUST_PROXY` as Express's `trust proxy` setting.
 *
 * Unset by default: a directly-exposed server must not believe a client's
 * `X-Forwarded-For`. Behind a load balancer it is required, or every request
 * reports the proxy's address and the login rate limit becomes one bucket for
 * the whole deployment.
 */
export function trustProxy(): TrustProxySetting | undefined {
    return readTrustProxy();
}

/**
 * The largest JSON / urlencoded body the API parses. Code rather than
 * environment: raise it here only if entries are genuinely larger — a body
 * over the cap is a bare 413 from the parser, before any controller runs.
 * Media uploads are multipart and capped separately (`config/media.ts`).
 */
export function bodyLimit(): string | number {
    return '1mb';
}
