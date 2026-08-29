import { randomBytes } from 'node:crypto';

/**
 * The prefix every signing secret carries, so one found in a log or a config
 * file is recognisable for what it is — and so a scanner can be taught to spot
 * a leaked one.
 */
export const SECRET_PREFIX = 'whsec_';

/** How many characters of the secret the UI may show after mint. */
const HINT_LENGTH = 4;

/** A freshly minted signing secret and the hint stored alongside it. */
export interface GeneratedSecret {
    /** The full secret. Shown to the operator exactly once. */
    secret: string;
    /** The trailing characters, safe to display forever. */
    hint: string;
}

/**
 * Mints a signing secret.
 *
 * 32 bytes of `randomBytes` — the same order of entropy as the API tokens, and
 * far more than an HMAC key needs. Base64url so it survives a shell, a YAML
 * file and an environment variable without quoting.
 */
export function generateSecret(): GeneratedSecret {
    const secret = `${SECRET_PREFIX}${randomBytes(32).toString('base64url')}`;
    return { secret, hint: secretHint(secret) };
}

/**
 * The displayable tail of a secret.
 *
 * Four characters is enough to tell "the one I rotated to" from "the one I
 * replaced" and far too little to shorten a brute force against a 256-bit key.
 */
export function secretHint(secret: string): string {
    return secret.slice(-HINT_LENGTH);
}
