import { TextAlign } from '@tiptap/extension-text-align';

/** The node types an alignment may be set on — the ones core round-trips it for. */
export const ALIGNABLE_TYPES = [
    'paragraph',
    'heading',
    'listItem',
    'taskItem',
    'blockquote',
    'callout',
    'image',
    'table',
    'tableCell',
    'tableHeader'
] as const;

/**
 * Alignment — TipTap's own `TextAlign`, with the one thing about it that does
 * not fit replaced: **where the value is written**.
 *
 * Upstream renders `style="text-align: …"`. The stored value here is HTML a
 * delivery surface styles for itself, and the sanitizer both runtimes share
 * drops an inline `text-align` — so upstream's version of this extension would
 * let an author centre a paragraph, show it centred, and lose it on save. The
 * attribute is re-pointed at `data-align`, which is in the sanitizer's
 * vocabulary, and nothing else about the extension changes.
 *
 * Keeping the extension (rather than writing our own, which is what this was)
 * is what lets the Simple Editor template's `TextAlignButton` work untouched:
 * it looks for an extension *named* `textAlign`, a `setTextAlign` command, and
 * a node attribute called `textAlign`. All three are upstream's.
 *
 * `left` is the default and is never written, which is what keeps a
 * centred-then-uncentred paragraph byte-identical to one nobody touched.
 */
export const BlockAlignment = TextAlign.extend({
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    textAlign: {
                        default: this.options.defaultAlignment,
                        parseHTML: (element) =>
                            element.getAttribute('data-align'),
                        renderHTML: (attributes) => {
                            const value = attributes['textAlign'];
                            return typeof value === 'string' &&
                                value !== this.options.defaultAlignment
                                ? { 'data-align': value }
                                : {};
                        }
                    }
                }
            }
        ];
    }
}).configure({
    types: [...ALIGNABLE_TYPES],
    alignments: ['left', 'center', 'right', 'justify'],
    defaultAlignment: 'left'
});
