/**
 * The built-in block-type identifiers and menu groups. Named constants, never
 * bare strings, so a rename is a compile error rather than a silently
 * unrenderable block.
 */

/** The block types the default schema registers. */
export const BLOCK_TYPE = {
    Paragraph: 'paragraph',
    Heading: 'heading',
    BulletedList: 'bulletedList',
    NumberedList: 'numberedList',
    Todo: 'todo',
    Quote: 'quote',
    Callout: 'callout',
    Code: 'code',
    Divider: 'divider',
    Image: 'image',
    Embed: 'embed',
    Toggle: 'toggle',
    Columns: 'columns',
    Column: 'column',
    Table: 'table',
    TableRow: 'tableRow',
    TableCell: 'tableCell',
    Media: 'media',
    File: 'file'
} as const;

/** A built-in block type. */
export type BuiltInBlockType = (typeof BLOCK_TYPE)[keyof typeof BLOCK_TYPE];

/** Slash-menu sections. A custom block may declare its own group string. */
export const BLOCK_GROUP = {
    Basic: 'basic',
    Media: 'media',
    Advanced: 'advanced'
} as const;

/** Callout tones — the accent a callout is drawn with. */
export const CALLOUT_TONE = {
    Info: 'info',
    Success: 'success',
    Warning: 'warning',
    Danger: 'danger',
    Neutral: 'neutral'
} as const;

/** A callout tone. */
export type CalloutTone = (typeof CALLOUT_TONE)[keyof typeof CALLOUT_TONE];

/** The valid callout tones, for validating a parsed `data-tone`. */
export const CALLOUT_TONES: readonly string[] = Object.values(CALLOUT_TONE);

/**
 * How a block's content is aligned. `left` is the absence of an alignment, not
 * a value — it is never stored, so an untouched document carries no alignment
 * markup at all.
 */
export const BLOCK_ALIGN = {
    Left: 'left',
    Center: 'center',
    Right: 'right',
    Justify: 'justify'
} as const;

/** A block alignment. */
export type BlockAlign = (typeof BLOCK_ALIGN)[keyof typeof BLOCK_ALIGN];

/** The alignments the editor offers, in menu order. */
export const BLOCK_ALIGNS: readonly BlockAlign[] = Object.values(BLOCK_ALIGN);

/**
 * How wide a media block draws. A **preset**, not a pixel value: the stored
 * HTML has to render on a surface whose measure this editor knows nothing
 * about, and "half the column" survives that where `width: 480px` does not.
 */
export const MEDIA_SIZE = {
    Small: 'small',
    Medium: 'medium',
    Large: 'large',
    Full: 'full'
} as const;

/** A media size preset. */
export type MediaSize = (typeof MEDIA_SIZE)[keyof typeof MEDIA_SIZE];

/** The sizes the editor offers, narrowest first. */
export const MEDIA_SIZES: readonly MediaSize[] = Object.values(MEDIA_SIZE);

/**
 * The text and highlight palette. Names, never hex — a stored `#f43f5e` is a
 * decision about someone else's design system, taken by whoever happened to be
 * writing that day and frozen into the content. A name resolves against the
 * surface it is rendered on, so the same document reads correctly in the admin,
 * on a light site, and on a dark one.
 */
export const INLINE_COLOR = {
    Default: 'default',
    Gray: 'gray',
    Brown: 'brown',
    Orange: 'orange',
    Yellow: 'yellow',
    Green: 'green',
    Blue: 'blue',
    Purple: 'purple',
    Pink: 'pink',
    Red: 'red'
} as const;

/** A palette colour. */
export type InlineColor = (typeof INLINE_COLOR)[keyof typeof INLINE_COLOR];

/** The palette, in menu order. `default` means "no colour" and is never stored. */
export const INLINE_COLORS: readonly InlineColor[] = Object.values(INLINE_COLOR);

/** Heading levels the editor offers — the full HTML range. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/** A heading level. */
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

/**
 * The typefaces a document may name.
 *
 * A **short list of roles**, not a font menu. The stored value has to render on
 * a surface whose fonts this editor never sees, so `serif` is something any
 * consumer can honour where `Helvetica Neue, Arial, sans-serif` is a guess
 * about a machine we have not met. `default` means "whatever the surface uses"
 * and is never stored.
 */
export const FONT_FAMILY = {
    Default: 'default',
    Sans: 'sans',
    Serif: 'serif',
    Mono: 'mono'
} as const;

/** A named typeface. */
export type FontFamily = (typeof FONT_FAMILY)[keyof typeof FONT_FAMILY];

/** The typefaces on offer, in menu order. */
export const FONT_FAMILIES: readonly FontFamily[] = Object.values(FONT_FAMILY);

/**
 * Relative text sizes. Steps, not points: a point size is a decision about a
 * viewport, and the same `14pt` that reads well in a desktop column is unusable
 * on a phone. `normal` is the absence of a size and is never stored.
 */
export const TEXT_SIZE = {
    Normal: 'normal',
    Small: 'small',
    Large: 'large',
    Huge: 'huge'
} as const;

/** A relative text size. */
export type TextSize = (typeof TEXT_SIZE)[keyof typeof TEXT_SIZE];

/** The sizes on offer, smallest first. */
export const TEXT_SIZES: readonly TextSize[] = Object.values(TEXT_SIZE);

/** What a {@link BLOCK_TYPE.Media} block plays. */
export const MEDIA_KIND = {
    Video: 'video',
    Audio: 'audio'
} as const;

/** A playable media kind. */
export type MediaKind = (typeof MEDIA_KIND)[keyof typeof MEDIA_KIND];

/** The playable kinds, in menu order. */
export const MEDIA_KINDS: readonly MediaKind[] = Object.values(MEDIA_KIND);
