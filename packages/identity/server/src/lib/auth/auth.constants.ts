/**
 * Shortest password accepted when a credential is first set (invite accept) or
 * replaced, counted in **characters**. Twelve with no composition rules —
 * length is what actually resists offline cracking, and arbitrary "one symbol,
 * one digit" rules push people toward predictable substitutions.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Longest password accepted, counted in **UTF-8 bytes** — see
 * {@link passwordByteLength}. bcrypt silently truncates its input at 72 bytes;
 * everything past that is ignored, so a user who believes their long passphrase
 * is stored in full would be wrong. We reject rather than truncate, so what the
 * user typed is always what protects the account.
 *
 * The unit is the whole point. A JavaScript string's `.length` counts UTF-16
 * code units, which is **not** what bcrypt measures: `'é'.repeat(72)` is 72
 * characters but 144 bytes, so a character-counted bound would accept it and
 * bcrypt would then hash only the first half of the passphrase. Validate with
 * {@link MaxByteLength}, never `@MaxLength`.
 */
export const MAX_PASSWORD_LENGTH = 72;

/**
 * The length of `password` in the unit bcrypt truncates on — UTF-8 bytes.
 * ASCII-only input reads the same as `.length`; anything else (accents, CJK,
 * emoji) reads longer, which is exactly the discrepancy the bound exists to
 * catch.
 */
export function passwordByteLength(password: string): number {
    return Buffer.byteLength(password, 'utf8');
}
