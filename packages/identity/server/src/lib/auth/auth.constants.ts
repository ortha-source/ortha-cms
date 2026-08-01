/**
 * Shortest password accepted when a credential is first set (invite accept) or
 * replaced. Twelve characters with no composition rules — length is what
 * actually resists offline cracking, and arbitrary "one symbol, one digit"
 * rules push people toward predictable substitutions.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Longest password accepted. bcrypt silently truncates its input at 72 **bytes**
 * — everything past that is ignored, so a user who believes their 200-character
 * passphrase is stored in full would be wrong. We reject rather than truncate,
 * so what the user typed is always what protects the account.
 */
export const MAX_PASSWORD_LENGTH = 72;
