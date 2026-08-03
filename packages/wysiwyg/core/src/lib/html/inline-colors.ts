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

import {
    FONT_FAMILY,
    INLINE_COLOR,
    TEXT_SIZE,
    type InlineColor
} from '../schema/block-types';

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

/**
 * The two **typographic** span marks — typeface and relative size.
 *
 * Same shape as the colour marks and for the same reason: a named value on a
 * `data-` attribute that the sanitizer pins to an enumeration. `sans`/`serif`/
 * `mono` and `small`/`large`/`huge` are roles a delivery surface can honour with
 * its own scale, where `Helvetica Neue, 14pt` is a guess about a machine this
 * editor has never seen.
 *
 * Their defaults — `default` and `normal` — mean *no mark*, so a run the author
 * set and then reset carries no markup at all.
 */
export const TYPOGRAPHY_MARK = {
    Font: 'font',
    Size: 'size'
} as const;

/** A typographic span mark. */
export type TypographyMark =
    (typeof TYPOGRAPHY_MARK)[keyof typeof TYPOGRAPHY_MARK];

/** The attribute each typographic mark is stored on, and its "unset" value. */
export const TYPOGRAPHY_MARK_ATTRIBUTE: Readonly<
    Record<TypographyMark, { readonly attribute: string; readonly unset: string }>
> = {
    [TYPOGRAPHY_MARK.Font]: {
        attribute: 'data-font',
        unset: FONT_FAMILY.Default
    },
    [TYPOGRAPHY_MARK.Size]: {
        attribute: 'data-text-size',
        unset: TEXT_SIZE.Normal
    }
};

/** Whether a value is a real choice rather than the mark's "unset". */
export function isTypographySet(
    mark: TypographyMark,
    value: string | null | undefined
): boolean {
    return (
        typeof value === 'string' &&
        value !== '' &&
        value !== TYPOGRAPHY_MARK_ATTRIBUTE[mark].unset
    );
}
