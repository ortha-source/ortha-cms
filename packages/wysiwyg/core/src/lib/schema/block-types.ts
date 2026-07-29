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
    TableCell: 'tableCell'
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

/** Heading levels the editor offers (h1–h4). */
export const HEADING_LEVELS = [1, 2, 3, 4] as const;

/** A heading level. */
export type HeadingLevel = (typeof HEADING_LEVELS)[number];
