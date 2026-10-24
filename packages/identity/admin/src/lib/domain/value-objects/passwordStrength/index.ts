import {
    PASSWORD_MIN_LENGTH,
    passwordByteLength,
    PASSWORD_MAX_BYTES
} from '../password';

/**
 * How strong a password reads, on the four-step scale the meter under a
 * new-password field draws:
 *
 * - `0` — nothing typed yet (the meter is empty and says only the rule).
 * - `1` — **too short** (or over the byte ceiling): the server will refuse it.
 * - `2` — **fair**: long enough, and nothing more.
 * - `3` — **good**.
 * - `4` — **strong**.
 */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/** The bars the meter draws — one per step above "nothing typed". */
export const PASSWORD_STRENGTH_STEPS = 4;

/**
 * Scores a password for the meter. **Advice, not a rule**: the only rule is
 * the server's length range ({@link PASSWORD_MIN_LENGTH} characters to
 * {@link PASSWORD_MAX_BYTES} bytes), and anything inside it is accepted
 * whatever this says.
 *
 * Length dominates on purpose — a long phrase of plain words beats a short
 * scramble, which is the advice the field's hint gives — and variety of
 * character classes only nudges. A value that is one character repeated, or a
 * plain run like `123456789012`, never rises above fair however long it is.
 *
 * Pure and dependency-free, so the meter can call it on every keystroke.
 */
export function passwordStrength(value: string): PasswordStrength {
    if (value.length === 0) return 0;
    if (
        value.length < PASSWORD_MIN_LENGTH ||
        passwordByteLength(value) > PASSWORD_MAX_BYTES
    ) {
        return 1;
    }
    if (isMonotonous(value)) return 2;

    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(
        (pattern) => pattern.test(value)
    ).length;

    let score = 2;
    if (value.length >= 16) score += 1;
    if (value.length >= 20) score += 1;
    if (classes >= 3) score += 1;
    return Math.min(score, 4) as PasswordStrength;
}

/**
 * A value with no information beyond its length: one character repeated, or a
 * run that only counts up or down (`abcdefghijkl`, `987654321098`).
 */
function isMonotonous(value: string): boolean {
    if (new Set(value).size <= 2) return true;
    const codes = [...value].map((char) => char.codePointAt(0) ?? 0);
    const steps = new Set(
        codes.slice(1).map((code, index) => {
            const step = code - codes[index];
            // `9 → 0` continues a digit run that wraps.
            return step === -9 || step === 9 ? Math.sign(-step) : step;
        })
    );
    return steps.size === 1 && [...steps].every((step) => Math.abs(step) <= 1);
}
