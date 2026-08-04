import type { AnyExtension } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Typography } from '@tiptap/extension-typography';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Placeholder, Selection } from '@tiptap/extensions';
import { HEADING_LEVELS } from '@ortha-cms/wysiwyg-core';
import { HorizontalRule } from '../../tiptap-ui/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension';
import { BlockAlignment } from './blockAlign';
import { StoredHighlight } from './highlight';
import { FontRole, TextColor, TextSize } from './storedMarks';
import {
    Callout,
    Column,
    Columns,
    Embed,
    ImageFigure,
    Toggle,
    ToggleSummary
} from './storedBlocks';
import { CellWidth } from './cellWidth';

/**
 * The editor's schema — the **Simple Editor template's extension set**, plus the
 * few things this CMS cannot do without.
 *
 * The template's list is taken as-is: StarterKit, the task list, images,
 * typography, super/subscript, the horizontal rule its node styles are written
 * for, and `Selection` (which keeps the selected range visible while focus is in
 * a toolbar overlay — the reason its link popover can act on what you had
 * selected). What is added falls into exactly two groups, and neither adds a
 * feature to the toolbar.
 *
 * **Two extensions are upstream's with one attribute re-pointed.** The value
 * this field stores is HTML, and it leaves through `normalizeWysiwygHtml` —
 * the same allow-list the server applies on write. Alignment as
 * `style="text-align"` and a highlight as `background-color: var(--tt-…)` are
 * both dropped by that pass, so upstream's versions would let an author apply
 * either, watch it apply, and lose it on save. `blockAlign.ts` and
 * `highlight.ts` write `data-align` and `data-highlight` instead; nothing else
 * about either extension changes, and the template's buttons drive them
 * untouched.
 *
 * **The rest are schema without UI, and are here so that documents already
 * saved survive being opened.** Callouts, toggles, columns, tables and the
 * typographic span marks are all in the sanitizer's vocabulary and exist in
 * stored content; a document containing one, opened in an editor whose schema
 * has never heard of it, comes back flattened on the next save. No toolbar
 * offers them — the Simple Editor has no such controls and this is its editor
 * now — but nothing an author wrote is destroyed by that.
 */
export function buildExtensions(options: {
    /** Shown in an empty paragraph. */
    placeholder?: string;
}): AnyExtension[] {
    return [
        // --- The Simple Editor template's set ------------------------------
        StarterKit.configure({
            heading: { levels: [...HEADING_LEVELS] },
            // The template ships its own, which its node stylesheet is written
            // for; the lists are configured below because a to-do list needs a
            // shape of its own and both share `listItem`.
            horizontalRule: false,
            bulletList: { keepMarks: true },
            orderedList: { keepMarks: true },
            // No `HTMLAttributes` on purpose. Setting `rel` would put it
            // *before* `href` in the rendered tag and the serializer keeps the
            // order it parsed, so every link would round-trip to a different
            // string than the one it came in as. The sanitizer already forces
            // `rel="noopener noreferrer"` onto any link that opens a new tab,
            // which is the pairing that actually matters.
            link: { openOnClick: false, enableClickSelection: true },
            underline: {},
            trailingNode: false
        }),
        HorizontalRule,
        Typography,
        Superscript,
        Subscript,
        Selection,
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

        // --- Upstream, writing what the sanitizer keeps --------------------
        BlockAlignment,
        StoredHighlight,

        // --- Schema only, so stored documents survive ----------------------
        TableKit.configure({ table: { resizable: false } }),
        CellWidth,
        // Not TipTap's `Image`, which is a bare void `<img>`: a stored figure
        // carries a caption and a width, and a schema that has never heard of
        // either turns the caption into a stray paragraph on the next save.
        ImageFigure,
        Callout,
        ToggleSummary,
        Toggle,
        Column,
        Columns,
        Embed,
        TextColor,
        FontRole,
        TextSize,

        Placeholder.configure({
            placeholder: ({ node }) =>
                node.type.name === 'paragraph' ? (options.placeholder ?? '') : ''
        })
    ];
}
