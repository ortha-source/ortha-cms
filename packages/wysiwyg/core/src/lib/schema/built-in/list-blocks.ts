/**
 * The list block types — bulleted, numbered, and to-do.
 *
 * Each list **item** is its own block, so it has its own caret, drag handle,
 * menu and nesting; the `<ul>`/`<ol>` around a run of them is produced by the
 * serializer's grouping (see {@link BlockWrapper}) and expanded again by the
 * parser. Nested lists are a list item's `children`, which the serializer
 * groups recursively at no extra cost.
 */

import type { HtmlElement, HtmlNode } from '../../html/node';
import type { BlockDefinition, BlockParseContext } from '../block-definition';
import { BLOCK_GROUP, BLOCK_TYPE } from '../block-types';

/** Tags that mark the start of a nested list inside a list item. */
const NESTED_LIST_TAGS: ReadonlySet<string> = new Set(['ul', 'ol']);

/** A list item's own text vs. the nested list underneath it. */
function splitItem(element: HtmlElement) {
    const inline: HtmlNode[] = [];
    const nested: HtmlNode[] = [];
    for (const node of element.children) {
        const isNested =
            node.kind === 'element' && NESTED_LIST_TAGS.has(node.tag);
        (isNested || nested.length > 0 ? nested : inline).push(node);
    }
    return { inline, nested };
}

/** Builds the shared `fromHtml` for a list item of `type`. */
function itemFromHtml(type: string) {
    return (element: HtmlElement, ctx: BlockParseContext) => {
        const { inline, nested } = splitItem(element);
        return ctx.block(type, {
            html: ctx.inline(inline),
            children: ctx.children(nested),
            ...(type === BLOCK_TYPE.Todo
                ? {
                      attrs: {
                          checked: element.attrs['data-checked'] === 'true'
                      }
                  }
                : {})
        });
    };
}

/** Serializes one `<li>`: its text, then any nested list under it. */
function itemToHtml(tag: string): BlockDefinition['toHtml'] {
    return (block, ctx) =>
        `<${tag}${ctx.align(block)}>${ctx.inline(block.html)}${ctx.children(
            block.children
        )}</${tag}>`;
}

/** An unordered list item. Enter continues the list. */
export const bulletedListBlock: BlockDefinition = {
    type: BLOCK_TYPE.BulletedList,
    content: 'inline',
    aligns: true,
    continueOnEnter: true,
    wrapper: {
        tag: 'ul',
        // A plain `<ul>` — one that isn't the to-do list's tagged variant.
        match: (element) => element.attrs['data-list'] !== BLOCK_TYPE.Todo
    },
    tags: ['li'],
    descriptor: {
        defaultLabel: 'Bulleted list',
        keywords: ['bullet', 'unordered', 'ul', 'list'],
        group: BLOCK_GROUP.Basic,
        order: 2
    },
    toHtml: itemToHtml('li'),
    fromHtml: itemFromHtml(BLOCK_TYPE.BulletedList)
};

/** An ordered list item. */
export const numberedListBlock: BlockDefinition = {
    type: BLOCK_TYPE.NumberedList,
    content: 'inline',
    aligns: true,
    continueOnEnter: true,
    wrapper: { tag: 'ol' },
    tags: ['li'],
    descriptor: {
        defaultLabel: 'Numbered list',
        keywords: ['ordered', 'ol', 'number', 'list'],
        group: BLOCK_GROUP.Basic,
        order: 3
    },
    toHtml: itemToHtml('li'),
    fromHtml: itemFromHtml(BLOCK_TYPE.NumberedList)
};

/**
 * A to-do item. Its checked state rides on the `<li>` as `data-checked` rather
 * than a nested `<input>`: the stored HTML is content, not a form, and a
 * consumer rendering it read-only shouldn't inherit a disabled checkbox.
 */
export const todoBlock: BlockDefinition = {
    type: BLOCK_TYPE.Todo,
    content: 'inline',
    aligns: true,
    continueOnEnter: true,
    defaultAttrs: { checked: false },
    wrapper: {
        tag: 'ul',
        attrs: { 'data-list': BLOCK_TYPE.Todo },
        match: (element) => element.attrs['data-list'] === BLOCK_TYPE.Todo
    },
    tags: ['li'],
    match: (element) => element.attrs['data-checked'] !== undefined,
    descriptor: {
        defaultLabel: 'To-do list',
        keywords: ['todo', 'task', 'checkbox', 'check'],
        group: BLOCK_GROUP.Basic,
        order: 4
    },
    toHtml: (block, ctx) => {
        const checked = block.attrs['checked'] === true;
        return `<li data-checked="${checked}"${ctx.align(block)}>${ctx.inline(
            block.html
        )}${ctx.children(block.children)}</li>`;
    },
    fromHtml: itemFromHtml(BLOCK_TYPE.Todo)
};
