import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type { LucideIcon } from 'lucide-react';
import { Blocks, Heading1, Heading2, Heading3 } from 'lucide-react';
import {
    BLOCK_GROUP,
    BLOCK_TYPE,
    type BlockAttrs,
    type BlockSchema
} from '@ortha-cms/wysiwyg-core';
import type { BlockViewRegistry } from '../../blocks/blockRegistry';

const messages = defineMessages({
    paragraph: { id: 'wysiwyg.type.paragraph', defaultMessage: 'Text' },
    paragraphHint: {
        id: 'wysiwyg.type.paragraph.hint',
        defaultMessage: 'Plain paragraph'
    },
    heading1: { id: 'wysiwyg.type.heading1', defaultMessage: 'Heading 1' },
    heading2: { id: 'wysiwyg.type.heading2', defaultMessage: 'Heading 2' },
    heading3: { id: 'wysiwyg.type.heading3', defaultMessage: 'Heading 3' },
    headingHint: {
        id: 'wysiwyg.type.heading.hint',
        defaultMessage: 'Section title'
    },
    bulleted: {
        id: 'wysiwyg.type.bulleted',
        defaultMessage: 'Bulleted list'
    },
    numbered: {
        id: 'wysiwyg.type.numbered',
        defaultMessage: 'Numbered list'
    },
    todo: { id: 'wysiwyg.type.todo', defaultMessage: 'To-do list' },
    quote: { id: 'wysiwyg.type.quote', defaultMessage: 'Quote' },
    callout: { id: 'wysiwyg.type.callout', defaultMessage: 'Callout' },
    code: { id: 'wysiwyg.type.code', defaultMessage: 'Code' },
    divider: { id: 'wysiwyg.type.divider', defaultMessage: 'Divider' },
    image: { id: 'wysiwyg.type.image', defaultMessage: 'Image' },
    embed: { id: 'wysiwyg.type.embed', defaultMessage: 'Embed' },
    toggle: { id: 'wysiwyg.type.toggle', defaultMessage: 'Toggle' },
    columns: { id: 'wysiwyg.type.columns', defaultMessage: 'Columns' },
    table: { id: 'wysiwyg.type.table', defaultMessage: 'Table' },
    groupBasic: { id: 'wysiwyg.group.basic', defaultMessage: 'Basic' },
    groupMedia: { id: 'wysiwyg.group.media', defaultMessage: 'Media' },
    groupAdvanced: {
        id: 'wysiwyg.group.advanced',
        defaultMessage: 'Advanced'
    },
    groupPlugins: {
        id: 'wysiwyg.group.plugins',
        defaultMessage: 'From plugins'
    }
});

/** One choosable block type — a slash-menu row and a "turn into" entry. */
export interface BlockTypeItem {
    /** Unique within the list — a type can appear more than once (headings). */
    readonly id: string;
    readonly type: string;
    /** Attributes applied with the type (which heading level, which tone). */
    readonly attrs?: BlockAttrs;
    readonly label: string;
    /** Extra words the search matches on, space-separated and lowercased. */
    readonly keywords: string;
    readonly group: string;
    readonly Icon: LucideIcon;
}

/** A named run of items — how both menus are sectioned. */
export interface BlockTypeGroup {
    readonly id: string;
    readonly label: string;
    readonly items: readonly BlockTypeItem[];
}

/** The built-in entries, in the order they read best in a menu. */
interface Seed {
    id: string;
    type: string;
    attrs?: BlockAttrs;
    message: keyof typeof messages;
    keywords: string;
    group: string;
    Icon?: LucideIcon;
}

const SEEDS: readonly Seed[] = [
    {
        id: BLOCK_TYPE.Paragraph,
        type: BLOCK_TYPE.Paragraph,
        message: 'paragraph',
        keywords: 'text paragraph plain body',
        group: BLOCK_GROUP.Basic
    },
    {
        id: 'heading-1',
        type: BLOCK_TYPE.Heading,
        attrs: { level: 1 },
        message: 'heading1',
        keywords: 'heading title h1',
        group: BLOCK_GROUP.Basic,
        Icon: Heading1
    },
    {
        id: 'heading-2',
        type: BLOCK_TYPE.Heading,
        attrs: { level: 2 },
        message: 'heading2',
        keywords: 'heading title h2 subtitle',
        group: BLOCK_GROUP.Basic,
        Icon: Heading2
    },
    {
        id: 'heading-3',
        type: BLOCK_TYPE.Heading,
        attrs: { level: 3 },
        message: 'heading3',
        keywords: 'heading title h3',
        group: BLOCK_GROUP.Basic,
        Icon: Heading3
    },
    {
        id: BLOCK_TYPE.BulletedList,
        type: BLOCK_TYPE.BulletedList,
        message: 'bulleted',
        keywords: 'bullet unordered list ul',
        group: BLOCK_GROUP.Basic
    },
    {
        id: BLOCK_TYPE.NumberedList,
        type: BLOCK_TYPE.NumberedList,
        message: 'numbered',
        keywords: 'ordered number list ol',
        group: BLOCK_GROUP.Basic
    },
    {
        id: BLOCK_TYPE.Todo,
        type: BLOCK_TYPE.Todo,
        message: 'todo',
        keywords: 'todo task checkbox check',
        group: BLOCK_GROUP.Basic
    },
    {
        id: BLOCK_TYPE.Quote,
        type: BLOCK_TYPE.Quote,
        message: 'quote',
        keywords: 'quote blockquote citation',
        group: BLOCK_GROUP.Basic
    },
    {
        id: BLOCK_TYPE.Callout,
        type: BLOCK_TYPE.Callout,
        message: 'callout',
        keywords: 'callout note info warning tip aside',
        group: BLOCK_GROUP.Basic
    },
    {
        id: BLOCK_TYPE.Divider,
        type: BLOCK_TYPE.Divider,
        message: 'divider',
        keywords: 'divider rule separator line hr',
        group: BLOCK_GROUP.Basic
    },
    {
        id: BLOCK_TYPE.Image,
        type: BLOCK_TYPE.Image,
        message: 'image',
        keywords: 'image picture photo media',
        group: BLOCK_GROUP.Media
    },
    {
        id: BLOCK_TYPE.Embed,
        type: BLOCK_TYPE.Embed,
        message: 'embed',
        keywords: 'embed video youtube link external',
        group: BLOCK_GROUP.Media
    },
    {
        id: BLOCK_TYPE.Code,
        type: BLOCK_TYPE.Code,
        message: 'code',
        keywords: 'code snippet pre monospace',
        group: BLOCK_GROUP.Advanced
    },
    {
        id: BLOCK_TYPE.Toggle,
        type: BLOCK_TYPE.Toggle,
        message: 'toggle',
        keywords: 'toggle collapse accordion details expand',
        group: BLOCK_GROUP.Advanced
    },
    {
        id: BLOCK_TYPE.Columns,
        type: BLOCK_TYPE.Columns,
        message: 'columns',
        keywords: 'columns layout grid split side by side',
        group: BLOCK_GROUP.Advanced
    },
    {
        id: BLOCK_TYPE.Table,
        type: BLOCK_TYPE.Table,
        message: 'table',
        keywords: 'table grid rows columns spreadsheet',
        group: BLOCK_GROUP.Advanced
    }
];

/** The group order and their localized headings. */
const GROUP_MESSAGE: Record<string, keyof typeof messages> = {
    [BLOCK_GROUP.Basic]: 'groupBasic',
    [BLOCK_GROUP.Media]: 'groupMedia',
    [BLOCK_GROUP.Advanced]: 'groupAdvanced'
};

/**
 * The block types on offer, grouped and localized.
 *
 * Built from the **live schema**, not from the seed list alone: a consumer that
 * registered a custom block type gets a menu entry for it automatically (from
 * the definition's `descriptor`), and a type the consumer *removed* disappears
 * from the menu instead of producing a command that does nothing.
 */
export function useBlockTypeItems(
    schema: BlockSchema,
    views: BlockViewRegistry
): readonly BlockTypeGroup[] {
    const intl = useIntl();

    return useMemo(() => {
        const items: BlockTypeItem[] = [];

        for (const seed of SEEDS) {
            if (!schema.get(seed.type)) continue;
            items.push({
                id: seed.id,
                type: seed.type,
                attrs: seed.attrs,
                label: intl.formatMessage(messages[seed.message]),
                keywords: seed.keywords,
                group: seed.group,
                Icon: seed.Icon ?? views[seed.type]?.Icon ?? Blocks
            });
        }

        // Anything the schema knows about that the seed list doesn't — a
        // consumer's own block type. Its `descriptor` carries the fallback
        // label; the admin has no translation for a type it has never seen.
        const seeded = new Set(SEEDS.map((seed) => seed.type));
        for (const definition of schema.menuDefinitions()) {
            if (seeded.has(definition.type) || !definition.descriptor) continue;
            items.push({
                id: definition.type,
                type: definition.type,
                label: definition.descriptor.defaultLabel,
                keywords: (definition.descriptor.keywords ?? []).join(' '),
                group: definition.descriptor.group ?? 'plugins',
                Icon: views[definition.type]?.Icon ?? Blocks
            });
        }

        return groupItems(items, (group) =>
            GROUP_MESSAGE[group]
                ? intl.formatMessage(messages[GROUP_MESSAGE[group]])
                : intl.formatMessage(messages.groupPlugins)
        );
    }, [intl, schema, views]);
}

/** Buckets items by `group`, preserving first-seen group order. */
function groupItems(
    items: readonly BlockTypeItem[],
    labelFor: (group: string) => string
): BlockTypeGroup[] {
    const groups: BlockTypeGroup[] = [];
    for (const item of items) {
        const existing = groups.find((group) => group.id === item.group);
        if (existing) {
            (existing.items as BlockTypeItem[]).push(item);
            continue;
        }
        groups.push({
            id: item.group,
            label: labelFor(item.group),
            items: [item]
        });
    }
    return groups;
}

/** Filters grouped items by a slash-menu query, dropping empty groups. */
export function filterBlockTypeGroups(
    groups: readonly BlockTypeGroup[],
    query: string
): BlockTypeGroup[] {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [...groups];
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) =>
                    item.label.toLowerCase().includes(needle) ||
                    item.keywords.includes(needle)
            )
        }))
        .filter((group) => group.items.length > 0);
}

/** A flat list of the items in `groups`, in display order. */
export function flattenBlockTypeGroups(
    groups: readonly BlockTypeGroup[]
): BlockTypeItem[] {
    return groups.flatMap((group) => [...group.items]);
}
