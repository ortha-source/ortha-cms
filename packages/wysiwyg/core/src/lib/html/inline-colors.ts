/**
 * Text colour and highlight — the two inline marks that are a *styling* choice
 * rather than a meaning.
 *
 * They are stored as `<span data-color="blue">` and `<mark data-highlight=
 * "yellow">`: named palette entries, never hex. A `#f43f5e` frozen into a
 * document is a decision about someone else's design system, taken by whoever
 * happened to be writing that day; a name is something the delivery surface can
 * map onto its own palette, in light mode and dark. The sanitizer pins both
 * attributes to {@link INLINE_COLORS}, so a value that survives a round trip is
 * one every consumer can rely on.
 *
 * `<mark>` for the highlight is deliberate — it already *means* "marked for
 * reference", so a document keeps that meaning even where the palette doesn't
 * reach (a plain-text export, a reader mode, a stylesheet that ignores
 * `data-highlight`).
 */

import { INLINE_COLOR, type InlineColor } from '../schema/block-types';

/** Which of the two colour marks is meant. */
export const COLOR_MARK = {
    /** The glyphs themselves — a `<span data-color>`. */
    Text: 'text',
    /** The background behind them — a `<mark data-highlight>`. */
    Highlight: 'highlight'
} as const;

/** A colour mark. */
export type ColorMark = (typeof COLOR_MARK)[keyof typeof COLOR_MARK];

/** The element and attribute each mark is stored as. */
export const COLOR_MARK_TAG: Readonly<
    Record<ColorMark, { readonly tag: string; readonly attribute: string }>
> = {
    [COLOR_MARK.Text]: { tag: 'span', attribute: 'data-color' },
    [COLOR_MARK.Highlight]: { tag: 'mark', attribute: 'data-highlight' }
};

/**
 * Whether `color` is a real colour rather than the palette's "no colour".
 * `default` is what the menu calls the absence of a choice; applying it means
 * *removing* the mark, so it is never written.
 */
export function isColorSet(color: string | null | undefined): boolean {
    return (
        typeof color === 'string' &&
        color !== '' &&
        color !== INLINE_COLOR.Default
    );
}

/** The colour a value denotes, or `null` when it denotes none. */
export function colorOrNull(
    color: string | null | undefined
): InlineColor | null {
    return isColorSet(color) ? (color as InlineColor) : null;
}
