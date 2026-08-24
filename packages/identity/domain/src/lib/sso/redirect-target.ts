/**
 * Validates the post-sign-in destination a `/start` request asked for.
 *
 * An open redirect on a login route is the most common bug in this entire
 * feature, and it is worth more to an attacker here than almost anywhere else:
 * the link really is the CMS's own sign-in, the person really does
 * authenticate, and the redirect that follows lands them somewhere of an
 * attacker's choosing while they are in the middle of trusting the flow.
 *
 * The rule is deliberately narrow — a **same-origin absolute path**, nothing
 * else. What that rejects, and why each shape needs naming:
 *
 * - anything not starting with `/` (`https://evil.test`, `evil.test`);
 * - `//host`, which is a protocol-relative URL wearing a leading slash;
 * - any backslash, because several browsers normalise it to `/` before
 *   parsing, making `/\evil.test` another spelling of the case above;
 * - any control character or space, which can truncate the value or smuggle a
 *   header break in a way the parser and the browser disagree about.
 *
 * Returns {@link fallback} for anything rejected. An unusable `redirect` is a
 * broken link, not an incident, and landing on the admin's home page is what
 * someone following a broken link expects.
 */
export function safeRedirectPath(
    requested: string | undefined | null,
    fallback = '/'
): string {
    if (typeof requested !== 'string' || requested === '') {
        return fallback;
    }
    // Checked before anything is parsed: control characters, spaces and
    // backslashes are exactly what let one value mean two different things to
    // this function and to a browser. Scanned rather than matched with a
    // regular expression, because a character class of raw control characters
    // is unreadable in source and lint rightly refuses it.
    for (const character of requested) {
        const code = character.codePointAt(0) ?? 0;
        if (code <= 0x20 || code === 0x7f || character === '\\') {
            return fallback;
        }
    }
    if (!requested.startsWith('/') || requested.startsWith('//')) {
        return fallback;
    }
    return requested;
}
