/**
 * Where the gutter sits on a block with no line of text to align to — an image,
 * a divider, a code block. Half of a `size-6` button below the row's top.
 */
const NO_LINE_CENTER = 14;

/** Line-height only falls back to this if a renderer leaves it `normal`. */
const NORMAL_LINE_HEIGHT_RATIO = 1.2;

/**
 * The vertical centre of a row's **first line of text**, in pixels down from
 * the top of the row — where that row's gutter belongs.
 *
 * It has to be measured, because it is the one thing about a block the gutter
 * cannot know statically: every renderer picks its own type scale and spacing,
 * so the offset that centres the handle differs by ~30px across block types —
 * an `h1` is `text-3xl mt-6` (first line centred ~42px down), a paragraph is
 * `py-1 leading-7` (~18px), a list item adds a wrapper's padding on top of
 * that. A single offset centred the handle on paragraphs and left it floating
 * well above the words of every heading.
 *
 * Measuring what the browser actually laid out also keeps the number in exactly
 * one place — the renderer's own classes — rather than restating each block's
 * metrics next to the affordance that has to match them.
 *
 * Two things the anchor lookup has to get right:
 *
 * - **Captions are not the first line.** An image's caption shares its block's
 *   path but renders under the picture, so aligning to it would drop the handle
 *   below 28rem of image. `InlineEditable` marks itself for that reason.
 * - **A child's line is not this block's line.** Nested blocks render *inside*
 *   this row, so the first anchor in the subtree may belong to a descendant —
 *   a `columns` block would align to the first line inside its first column.
 *   The anchor counts only if this row is the nearest block around it.
 */
export function firstLineCenter(row: HTMLElement): number {
    const anchor = findLineAnchor(row);
    if (!anchor) return NO_LINE_CENTER;

    const style = getComputedStyle(anchor);
    const parsedLineHeight = parseFloat(style.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight)
        ? parsedLineHeight
        : parseFloat(style.fontSize) * NORMAL_LINE_HEIGHT_RATIO;
    const paddingTop = parseFloat(style.paddingTop) || 0;

    // Measured rather than summed from offsets: the heading's `mt-6` and the
    // list wrapper's padding sit between the row and the anchor, and whether a
    // margin lands inside the row or collapses out of it is not something worth
    // predicting.
    const offset =
        anchor.getBoundingClientRect().top - row.getBoundingClientRect().top;

    return offset + paddingTop + lineHeight / 2;
}

/** This row's own leading editable — not a caption's, not a descendant's. */
function findLineAnchor(row: HTMLElement): HTMLElement | null {
    const anchors = row.querySelectorAll<HTMLElement>('[data-line-anchor]');
    for (const anchor of anchors) {
        if (anchor.closest('[data-block-path]') === row) return anchor;
    }
    return null;
}
