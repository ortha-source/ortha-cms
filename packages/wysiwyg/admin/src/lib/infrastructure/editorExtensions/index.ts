/**
 * The editor's extension set — the one place that decides what an author can
 * actually write. The toolbar only exposes commands that come from here, so
 * this list and `WysiwygToolbar` are read together.
 */

import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { Callout } from '../extensions/callout';
import { Language } from '../extensions/language';
import { Column, ColumnBlock } from '../extensions/columns';
import { TableTab } from '../extensions/tableTab';
import { ResizableImage, ResizableVideo } from '../extensions/media';

/** Heading levels the editor offers. Deeper than h4 has no place in a CMS body. */
const HEADING_LEVELS = [1, 2, 3, 4] as const;

/** Node types whose text alignment can be set. Marks (bold, links) can't align. */
const ALIGNABLE = ['heading', 'paragraph'];

/**
 * Builds the extension list for one editor instance.
 *
 * `placeholder` is per-field (it comes from the field's `admin.placeholder`),
 * which is why this is a function rather than a shared constant — two editors
 * on the same form must not share configured extension instances.
 */
export function editorExtensions(placeholder: string): AnyExtension[] {
    return [
        StarterKit.configure({
            heading: { levels: [...HEADING_LEVELS] },
            // A CMS body links to pages that don't exist yet, so a click must
            // put the caret in the text rather than navigate the admin away.
            // `rel` is baked in: content authored here is published, and an
            // un-rel'd external link is a referrer leak on someone's site.
            link: {
                openOnClick: false,
                autolink: true,
                HTMLAttributes: { rel: 'noopener noreferrer nofollow' }
            }
        }),
        // Required by Color and FontSize — both are attributes of the
        // `textStyle` mark, and without it neither has anywhere to live.
        TextStyle,
        Color,
        FontSize,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ALIGNABLE }),
        // `scope="col"` on every header cell. TipTap's `TableHeader` renders a
        // bare `<th colspan rowspan colwidth>`, which leaves a screen reader to
        // *infer* which cells a header governs from proximity — usually right
        // for a plain grid, unreliable the moment a cell spans (WCAG 1.3.1).
        // The insert command is the only way a table is created here and it
        // always builds a header **row**, so `col` is the correct scope for
        // every `<th>` this editor can produce; a header *column* would need a
        // toggle that does not exist yet, and would need `scope="row"` with it.
        //
        // Set through `HTMLAttributes` rather than a `renderHTML` override so
        // the attribute rides the node's own serialization — which means the
        // preview (`renderRichText` re-serializes through this same schema) and
        // the published body both carry it.
        TableKit.configure({
            table: { resizable: true },
            tableHeader: { HTMLAttributes: { scope: 'col' } }
        }),
        // Bounds Tab at the end of a table so it adds **one** row rather than
        // one per press — see `TableTab`. Listed after `TableKit` for reading
        // order only; which binding is offered the key first is decided by
        // `priority`, not by position here.
        TableTab,
        Callout,
        // Language of parts (WCAG 3.1.2) — a run of text in another language
        // carries its own `lang`, so a quoted passage is announced with the
        // right phonemes instead of the page's.
        Language,
        ColumnBlock,
        Column,
        // Media the author embeds. Where it *comes from* is not decided here —
        // `WYSIWYG_MEDIA_SLOT` is what a media plugin fills; these two nodes
        // just hold whatever any source hands over.
        ResizableImage,
        ResizableVideo,
        Placeholder.configure({ placeholder }),
        // Powers the editor's footer count. Informational only, but it is now
        // the **same** count the field's `maxLength` is measured in — a rich
        // text value is a document, and its length rules are counted over the
        // body's text rather than over the markup around it. (Still not a hard
        // cap here: the limit belongs to the field, and the count is a reading
        // of the document, not a gate on typing.)
        CharacterCount
        // No `TrailingNode` here on purpose — StarterKit already registers it,
        // and adding a second copy makes TipTap warn about a duplicate name and
        // resolve the extension set unpredictably. It is what guarantees a
        // paragraph after the last block, so a document ending in a table, a
        // callout, or a column layout is not a dead end the caret can't get
        // past; if StarterKit ever drops it, add it back rather than living
        // without it.
    ];
}
