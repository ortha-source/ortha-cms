import type { AnyExtension } from '@tiptap/core';
import type { BlockTypeItem } from './blockTypes';
import { StarterKit } from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import {
    Table,
    TableCell,
    TableHeader,
    TableRow
} from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TiptapImageBlock } from './TiptapImageBlock';
import { TiptapTable } from './TiptapTable';
import { TiptapCalloutBlock } from './TiptapCalloutBlock';
import { TiptapEmbedBlock } from './TiptapEmbedBlock';
import { HEADING_LEVELS } from '@ortha-cms/wysiwyg-core';
import { BlockAlignment } from './blockAlign';
import { FontRole, TextColor, TextHighlight, TextSize } from './inlineMarks';
import {
    Callout,
    Column,
    Columns,
    Embed,
    ImageFigure,
    Toggle,
    ToggleSummary
} from './blockNodes';
import { CellWidth } from './cellWidth';
import { SlashCommand } from './slashCommand';
import { BLOCK_TYPES, filterBlockTypes } from './blockTypes';
import type { SlashMenuState } from './slashCommand';

/**
 * The editor's schema — **one description of the document**, used to render it
 * and to read it back.
 *
 * That single description is the whole reason for putting the schema in
 * TipTap's hands. Before, a block type was a renderer on one side and a
 * serializer on the other, agreeing by convention; here each node states the
 * HTML it is, once, and TipTap derives both directions from it.
 *
 * What is *not* here is the security boundary. The value still leaves through
 * `normalizeWysiwygHtml`, which parses and re-serializes against the same
 * allow-list the server applies on write — so what this schema has to get right
 * is being *parseable*, not being canonical. Two consequences worth stating:
 * an editor bug cannot widen what HTML is storable, and the stored value stays
 * byte-identical whichever half of the system produced it.
 */
export function buildExtensions(options: {
    /** Shown in an empty paragraph. */
    placeholder?: string;
    /** Formats a block's label, so the `/` query can match on it. */
    formatLabel?: (label: BlockTypeItem['label']) => string;
    /** Publishes the `/` palette's state, or `null` when it closes. */
    onSlashChange?: (state: SlashMenuState | null) => void;
}): AnyExtension[] {
    return [
        StarterKit.configure({
            heading: { levels: [...HEADING_LEVELS] },
            // The list extensions are configured below, as a to-do list needs
            // its own shape and both share `listItem`.
            bulletList: { keepMarks: true },
            orderedList: { keepMarks: true },
            // No `HTMLAttributes` here on purpose. Setting `rel` would put it
            // *before* `href` in the rendered tag, and the serializer keeps the
            // order it parsed — so every link would round-trip to a different
            // string than the one it came in as. The sanitizer already forces
            // `rel="noopener noreferrer"` onto any link that opens a new tab,
            // which is the pairing that actually matters.
            // TipTap renders `target` and `rel` ahead of `href`; the sanitizer
            // pins anchors back to `href`-first, so a link this editor merely
            // opened is not rewritten on the way out.
            link: { openOnClick: false, autolink: true },
            // `<u>` is not in StarterKit's default set.
            underline: {},
            trailingNode: false
        }),
        // A to-do list is a `<ul data-list="todo">` of `<li data-checked>`,
        // which is the shape core parses — TipTap's own is `data-type`.
        TaskList.extend({
            renderHTML({ HTMLAttributes }) {
                return ['ul', { ...HTMLAttributes, 'data-list': 'todo' }, 0];
            },
            parseHTML() {
                return [{ tag: 'ul[data-list="todo"]', priority: 100 }];
            }
        }),
        TaskItem.extend({
            renderHTML({ node, HTMLAttributes }) {
                return [
                    'li',
                    {
                        ...HTMLAttributes,
                        'data-checked': node.attrs['checked'] ? 'true' : 'false'
                    },
                    0
                ];
            },
            parseHTML() {
                return [{ tag: 'li[data-checked]', priority: 100 }];
            }
        }).configure({ nested: true }),
        // `TableKit` is unpacked rather than configured because only the table
        // itself takes a node view. Its cells deliberately do not: a React node
        // view always wraps its component in an element of its own, and nothing
        // may stand between a `<tr>` and its `<td>`.
        Table.extend({
            addNodeView: () =>
                // The rows go in a `<tbody>`, not the `<div>` a node view holds
                // its content in by default — a table's children have to be
                // table children or the browser invents anonymous boxes for
                // them.
                ReactNodeViewRenderer(TiptapTable, {
                    contentDOMElementTag: 'tbody'
                })
        }).configure({ resizable: false, allowTableNodeSelection: true }),
        TableRow,
        TableHeader,
        TableCell,
        CellWidth,
        BlockAlignment,
        TextColor,
        TextHighlight,
        FontRole,
        TextSize,
        Callout.extend({
            addNodeView: () => ReactNodeViewRenderer(TiptapCalloutBlock)
        }),
        ToggleSummary,
        Toggle.extend({
            // A plain DOM node view, not a React one, and that is the whole
            // reason it exists: `<summary>` only works as a **direct** child of
            // `<details>`, and a React node view always puts an element of its
            // own in between. Here the content element *is* the `<details>`.
            //
            // It is held open because a closed one hides its children from
            // layout, and content with no layout has no caret — an author could
            // see the summary of a toggle they had written and reach no word of
            // what was inside it. Open is an editing state: it is never
            // serialized, so how a toggle first appears to a reader stays the
            // delivery surface's decision.
            addNodeView: () => () => {
                const dom = document.createElement('details');
                dom.open = true;
                return { dom, contentDOM: dom };
            }
        }),
        Column,
        Columns,
        // The node views are added here rather than on the nodes themselves, so
        // `blockNodes.ts` stays what it claims to be: the schema, and only the
        // schema. A view is how a block is *edited*; it has no say in what the
        // document is or what it serializes to.
        ImageFigure.extend({
            addNodeView: () => ReactNodeViewRenderer(TiptapImageBlock)
        }),
        Embed.extend({
            addNodeView: () => ReactNodeViewRenderer(TiptapEmbedBlock)
        }),
        SlashCommand.configure({
            items: (query) =>
                options.formatLabel
                    ? filterBlockTypes(query, options.formatLabel)
                    : [...BLOCK_TYPES],
            onStateChange: (state) => options.onSlashChange?.(state)
        }),
        Placeholder.configure({
            placeholder: ({ node }) =>
                node.type.name === 'paragraph'
                    ? (options.placeholder ?? '')
                    : ''
        })
    ];
}
