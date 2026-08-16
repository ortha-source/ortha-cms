/**
 * The platform's command-key glyph for the ⌘J / Ctrl+J shortcut that starts a
 * chat.
 *
 * The handler accepts `metaKey || ctrlKey`, so the shortcut itself works
 * everywhere — but the `Kbd` chip on the dock's button hard-coded `⌘`, which
 * told every Windows and Linux reader to press a key their keyboard does not
 * have, on the one affordance whose whole job is to teach the shortcut.
 *
 * `Ctrl` is the fallback for an unknown or server-rendered environment on
 * purpose: it is the safer wrong answer, because Ctrl+J is accepted on macOS
 * too while ⌘J is not accepted anywhere else.
 *
 * Deliberately a local copy of `content/admin`'s `shortcutModifierGlyph`, which
 * fixed the identical bug on ⌘K: it is not exported from that package's barrel,
 * and taking a dependency from one feature plugin on another for six lines of
 * platform sniffing costs more than the duplication does.
 */
export function shortcutModifierGlyph(): string {
    if (typeof navigator === 'undefined') return 'Ctrl';
    const platform =
        (navigator as Navigator & { userAgentData?: { platform?: string } })
            .userAgentData?.platform ??
        navigator.platform ??
        '';
    return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl';
}

/**
 * The same shortcut in the space-separated form `aria-keyshortcuts` expects —
 * both accepted chords, so assistive tech announces the one its user can press
 * rather than whichever glyph the chip happens to be showing.
 */
export const NEW_CHAT_KEY_SHORTCUTS = 'Meta+J Control+J';
