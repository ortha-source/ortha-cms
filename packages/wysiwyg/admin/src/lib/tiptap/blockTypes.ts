import {
    ChevronRight,
    Code2,
    Columns2,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Heading5,
    Heading6,
    Image as ImageIcon,
    Info,
    Link2,
    List,
    ListOrdered,
    ListTodo,
    Minus,
    Quote,
    Table as TableIcon,
    Type,
    type LucideIcon
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { defineMessages, type MessageDescriptor } from 'react-intl';
import { BLOCK_GROUP, HEADING_LEVELS } from '@ortha-cms/wysiwyg-core';

const messages = defineMessages({
    paragraph: { id: 'wysiwyg.block.paragraph', defaultMessage: 'Text block' },
    heading1: { id: 'wysiwyg.block.heading1', defaultMessage: 'Heading 1' },
    heading2: { id: 'wysiwyg.block.heading2', defaultMessage: 'Heading 2' },
    heading3: { id: 'wysiwyg.block.heading3', defaultMessage: 'Heading 3' },
    heading4: { id: 'wysiwyg.block.heading4', defaultMessage: 'Heading 4' },
    heading5: { id: 'wysiwyg.block.heading5', defaultMessage: 'Heading 5' },
    heading6: { id: 'wysiwyg.block.heading6', defaultMessage: 'Heading 6' },
    bulletList: {
        id: 'wysiwyg.block.bulletList',
        defaultMessage: 'Bulleted list'
    },
    orderedList: {
        id: 'wysiwyg.block.orderedList',
        defaultMessage: 'Numbered list'
    },
    taskList: { id: 'wysiwyg.block.taskList', defaultMessage: 'To-do list' },
    quote: { id: 'wysiwyg.block.quote', defaultMessage: 'Quote' },
    callout: { id: 'wysiwyg.block.callout', defaultMessage: 'Callout' },
    code: { id: 'wysiwyg.block.code', defaultMessage: 'Code' },
    divider: { id: 'wysiwyg.block.divider', defaultMessage: 'Divider' },
    image: { id: 'wysiwyg.block.image', defaultMessage: 'Image' },
    embed: { id: 'wysiwyg.block.embed', defaultMessage: 'Embed' },
    toggle: { id: 'wysiwyg.block.toggle', defaultMessage: 'Toggle' },
    columns: { id: 'wysiwyg.block.columns', defaultMessage: 'Columns' },
    table: { id: 'wysiwyg.block.table', defaultMessage: 'Table' }
});

/** One entry of the block catalogue. */
export interface BlockTypeItem {
    /** Stable id — the slash menu's `aria-activedescendant` needs one. */
    readonly id: string;
    readonly label: MessageDescriptor;
    readonly Icon: LucideIcon;
    /** Which section of the slash menu it appears under. */
    readonly group: string;
    /** Extra words the slash menu matches on. */
    readonly keywords: readonly string[];
    /** Whether the caret is currently in a block of this type. */
    isActive(editor: Editor): boolean;
    /** Turns the block at the caret into this type, or inserts one. */
    apply(editor: Editor): void;
}

const HEADING_LABEL = [
    messages.heading1,
    messages.heading2,
    messages.heading3,
    messages.heading4,
    messages.heading5,
    messages.heading6
];
const HEADING_ICON = [
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Heading5,
    Heading6
];

/**
 * Every block an author can reach — **one list**, used by the toolbar's
 * "turn into" picker, the slash palette and the gutter's menu.
 *
 * The old editor derived this from the block schema's `descriptor`, which was
 * the right instinct in a package that owned the schema. TipTap owns it now,
 * and a schema node has no opinion about what a menu should call it or which
 * icon it wears — so the catalogue is its own thing, and the three menus that
 * present it cannot drift apart.
 */
export const BLOCK_TYPES: readonly BlockTypeItem[] = [
    {
        id: 'paragraph',
        label: messages.paragraph,
        Icon: Type,
        group: BLOCK_GROUP.Basic,
        keywords: ['text', 'paragraph', 'body'],
        isActive: (editor) => editor.isActive('paragraph'),
        apply: (editor) => editor.chain().focus().setParagraph().run()
    },
    ...HEADING_LEVELS.map((level) => ({
        id: `heading-${level}`,
        label: HEADING_LABEL[level - 1],
        Icon: HEADING_ICON[level - 1],
        group: BLOCK_GROUP.Basic,
        keywords: ['heading', 'title', `h${level}`],
        isActive: (editor: Editor) => editor.isActive('heading', { level }),
        apply: (editor: Editor) =>
            editor.chain().focus().setNode('heading', { level }).run()
    })),
    {
        id: 'bulletList',
        label: messages.bulletList,
        Icon: List,
        group: BLOCK_GROUP.Basic,
        keywords: ['bullet', 'unordered', 'list'],
        isActive: (editor) => editor.isActive('bulletList'),
        apply: (editor) => editor.chain().focus().toggleBulletList().run()
    },
    {
        id: 'orderedList',
        label: messages.orderedList,
        Icon: ListOrdered,
        group: BLOCK_GROUP.Basic,
        keywords: ['number', 'ordered', 'list'],
        isActive: (editor) => editor.isActive('orderedList'),
        apply: (editor) => editor.chain().focus().toggleOrderedList().run()
    },
    {
        id: 'taskList',
        label: messages.taskList,
        Icon: ListTodo,
        group: BLOCK_GROUP.Basic,
        keywords: ['todo', 'task', 'checkbox', 'check'],
        isActive: (editor) => editor.isActive('taskList'),
        apply: (editor) => editor.chain().focus().toggleTaskList().run()
    },
    {
        id: 'quote',
        label: messages.quote,
        Icon: Quote,
        group: BLOCK_GROUP.Basic,
        keywords: ['quote', 'blockquote', 'citation'],
        isActive: (editor) => editor.isActive('blockquote'),
        apply: (editor) => editor.chain().focus().toggleBlockquote().run()
    },
    {
        id: 'callout',
        label: messages.callout,
        Icon: Info,
        group: BLOCK_GROUP.Basic,
        keywords: ['callout', 'note', 'aside', 'warning', 'info'],
        isActive: (editor) => editor.isActive('callout'),
        apply: (editor) =>
            editor.chain().focus().wrapIn('callout').run()
    },
    {
        id: 'divider',
        label: messages.divider,
        Icon: Minus,
        group: BLOCK_GROUP.Basic,
        keywords: ['divider', 'rule', 'separator', 'hr', 'line'],
        isActive: () => false,
        apply: (editor) => editor.chain().focus().setHorizontalRule().run()
    },
    {
        id: 'code',
        label: messages.code,
        Icon: Code2,
        group: BLOCK_GROUP.Advanced,
        keywords: ['code', 'snippet', 'pre'],
        isActive: (editor) => editor.isActive('codeBlock'),
        apply: (editor) => editor.chain().focus().toggleCodeBlock().run()
    },
    {
        id: 'image',
        label: messages.image,
        Icon: ImageIcon,
        group: BLOCK_GROUP.Media,
        keywords: ['image', 'picture', 'photo', 'img', 'media'],
        isActive: (editor) => editor.isActive('image'),
        apply: (editor) =>
            editor
                .chain()
                .focus()
                .insertContent({ type: 'image', attrs: { src: '' } })
                .run()
    },
    {
        id: 'embed',
        label: messages.embed,
        Icon: Link2,
        group: BLOCK_GROUP.Media,
        keywords: ['embed', 'video', 'youtube', 'external', 'link'],
        isActive: (editor) => editor.isActive('embed'),
        apply: (editor) =>
            editor
                .chain()
                .focus()
                .insertContent({ type: 'embed', attrs: { url: '' } })
                .run()
    },
    {
        id: 'toggle',
        label: messages.toggle,
        Icon: ChevronRight,
        group: BLOCK_GROUP.Advanced,
        keywords: ['toggle', 'details', 'collapse', 'accordion'],
        isActive: (editor) => editor.isActive('toggle'),
        apply: (editor) =>
            editor
                .chain()
                .focus()
                .insertContent({
                    type: 'toggle',
                    content: [
                        { type: 'toggleSummary' },
                        { type: 'paragraph' }
                    ]
                })
                .run()
    },
    {
        id: 'columns',
        label: messages.columns,
        Icon: Columns2,
        group: BLOCK_GROUP.Advanced,
        keywords: ['columns', 'layout', 'side by side', 'grid'],
        isActive: (editor) => editor.isActive('columns'),
        apply: (editor) =>
            editor
                .chain()
                .focus()
                .insertContent({
                    type: 'columns',
                    content: [
                        { type: 'column', content: [{ type: 'paragraph' }] },
                        { type: 'column', content: [{ type: 'paragraph' }] }
                    ]
                })
                .run()
    },
    {
        id: 'table',
        label: messages.table,
        Icon: TableIcon,
        group: BLOCK_GROUP.Advanced,
        keywords: ['table', 'grid', 'rows', 'columns', 'spreadsheet'],
        isActive: (editor) => editor.isActive('table'),
        apply: (editor) =>
            editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
    }
];

/** The catalogue narrowed to a slash query, keeping the menu's own order. */
export function filterBlockTypes(
    query: string,
    format: (label: MessageDescriptor) => string
): BlockTypeItem[] {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [...BLOCK_TYPES];
    return BLOCK_TYPES.filter((item) => {
        const haystack = [
            format(item.label).toLowerCase(),
            ...item.keywords
        ].join(' ');
        return haystack.includes(needle);
    });
}
