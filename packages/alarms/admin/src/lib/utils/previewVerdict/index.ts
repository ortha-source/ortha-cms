/** What the editor's "Right now" panel says about a preview. */
export type PreviewVerdict = {
    /**
     * Every record in the collection matches — the condition is probably
     * inverted. Only meaningful over a non-empty collection: zero of zero is
     * an empty collection, not a backwards condition.
     */
    inverted: boolean;
    /** How many matching records the sample does not show ("and 34 more"). */
    more: number;
};

/**
 * Reads a preview the way the panel presents it. Pure, so the one judgement
 * this form exists to make — "this flags everything" — is unit tested rather
 * than left to a template.
 */
export function previewVerdict(preview: {
    matched: number;
    total: number;
    sample: readonly unknown[];
}): PreviewVerdict {
    return {
        inverted: preview.total > 0 && preview.matched >= preview.total,
        more: Math.max(0, preview.matched - preview.sample.length)
    };
}

/**
 * A collection's label as a noun inside a sentence: "of 842 articles". Only
 * the first letter is lowered, and only when the second is already lower
 * case — "Articles" becomes "articles", while "FAQ entries" stays as written.
 */
export function inlineTypeLabel(label: string): string {
    if (label.length < 2) return label;
    const second = label.charAt(1);
    return second === second.toLowerCase() && second !== second.toUpperCase()
        ? label.charAt(0).toLowerCase() + label.slice(1)
        : label;
}

/**
 * How long ago `iso` happened, as the `[value, unit]` pair
 * `formatRelativeTime` takes — always relative, never a date, because what a
 * flagged record's age says is how long it has been rotting, and "flagged 2
 * weeks ago" says that where "flagged Oct 10" makes the reader do sums.
 */
export function ageParts(
    iso: string,
    now: number = Date.now()
): [number, 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'] {
    const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
    if (minutes < 60) return [-minutes, 'minute'];
    const hours = Math.round(minutes / 60);
    if (hours < 24) return [-hours, 'hour'];
    const days = Math.round(hours / 24);
    if (days < 7) return [-days, 'day'];
    if (days < 30) return [-Math.round(days / 7), 'week'];
    if (days < 365) return [-Math.round(days / 30), 'month'];
    return [-Math.round(days / 365), 'year'];
}
