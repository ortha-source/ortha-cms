import { Highlight } from '@tiptap/extension-highlight';

/**
 * Highlight — TipTap's own, with the one thing about it that does not fit
 * replaced: **which attribute the colour is written to**.
 *
 * Upstream renders `<mark data-color="…" style="background-color: …">`. The
 * template's palette fills that with `var(--tt-color-highlight-green)`, and the
 * sanitizer both runtimes share keeps only a palette *name* or a `#hex` — so
 * upstream's version would let an author highlight a phrase, watch it apply,
 * and lose it on save.
 *
 * The palette is re-pointed at the names core already speaks (they are the same
 * ten words either way — gray, brown, orange, yellow, green, blue, purple,
 * pink, red) and the attribute at `data-highlight`, which is what the shared
 * prose stylesheet draws and what every document saved so far contains.
 *
 * Everything else is upstream's, including `ColorHighlightPopover`: it sets
 * whatever `value` its palette entry carries, and does not care what the mark
 * does with it.
 */
export const StoredHighlight = Highlight.extend({
    addAttributes() {
        return {
            color: {
                default: null,
                parseHTML: (element) =>
                    element.getAttribute('data-highlight') ??
                    element.getAttribute('data-color'),
                renderHTML: (attributes) => {
                    const value = attributes['color'];
                    return typeof value === 'string' && value !== ''
                        ? { 'data-highlight': value }
                        : {};
                }
            }
        };
    }
}).configure({ multicolor: true });
