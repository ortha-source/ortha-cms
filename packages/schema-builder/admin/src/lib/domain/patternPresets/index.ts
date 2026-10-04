/** A pattern people reach for often enough to offer by name. */
export type PatternPreset = {
    readonly id: 'slug' | 'email' | 'url';
    readonly pattern: string;
};

/** The presets the pattern editor offers. Anything else is typed by hand. */
export const PATTERN_PRESETS: readonly PatternPreset[] = [
    { id: 'slug', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    { id: 'email', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    { id: 'url', pattern: '^https?://\\S+$' }
];

/** Whether `value` matches `pattern`, or `null` when the pattern does not compile. */
export function testPattern(pattern: string, value: string): boolean | null {
    try {
        return new RegExp(pattern).test(value);
    } catch {
        return null;
    }
}
