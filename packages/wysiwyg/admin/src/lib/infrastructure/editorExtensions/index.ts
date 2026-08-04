/**
 * The editor's extension set — the one place that decides what an author can
 * actually write. The toolbar only exposes commands that come from here, so
 * this list and `WysiwygToolbar` are read together.
 */

import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CharacterCount, Placeholder, TrailingNode } from '@tiptap/extensions';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { Callout } from '../extensions/callout';
import { Column, ColumnBlock } from '../extensions/columns';

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
        TableKit.configure({ table: { resizable: true } }),
        Callout,
        ColumnBlock,
        Column,
        Placeholder.configure({ placeholder }),
        // Powers the dialog's footer count. Informational only: a `richtext`
        // field's `maxLength` is validated against the **HTML** string (tags
        // included), so capping the editor at that number would cut authors off
        // well before the real limit and still not guarantee they clear it.
        CharacterCount,
        // Guarantees a paragraph after the last block, so a document ending in
        // a table, a callout, or a column layout still has somewhere to type.
        // Without it those nodes are a dead end the caret can't get past.
        TrailingNode
    ];
}
