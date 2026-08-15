/**
 * The platform's command-key glyph for the ⌘K / Ctrl+K search shortcut.
 *
 * The handler accepts `metaKey || ctrlKey`, so both platforms work — but the
 * chip beside the search trigger used to hard-code `⌘`, telling every
 * Windows/Linux reader the wrong key. Derived from the UA platform string, with
 * Apple as the only `⌘` case and `Ctrl` as the fallback (which is also what a
 * server-rendered or unknown environment gets — the safer wrong answer, since
 * Ctrl+K works everywhere including macOS).
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
 * The same shortcut in the space-separated form `aria-keyshortcuts` expects
 * (`Meta+K Control+K`) — both accepted chords, so assistive tech announces the
 * one its user can press rather than the glyph the chip happens to show.
 */
export const SEARCH_KEY_SHORTCUTS = 'Meta+K Control+K';
