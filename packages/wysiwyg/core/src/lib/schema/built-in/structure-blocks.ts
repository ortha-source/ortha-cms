/**
 * The structural block types — code, toggle, and the two-part column layout.
 *
 * `columns`/`column` are the package's proof that the model is genuinely a
 * tree rather than a list with decorations: a column holds arbitrary blocks,
 * including another layout, and neither the parser, the serializer, nor the
 * editor's keyboard handling has a special case for it.
 */

import { escapeHtmlText } from '../../html/escape';
import { isElement, type HtmlElement } from '../../html/node';
import { nodeText } from '../../text/plain-text';
import type { BlockDefinition } from '../block-definition';
import { BLOCK_GROUP, BLOCK_TYPE } from '../block-types';

/**
 * A code block. Its `html` is **escaped plain text**, not marked-up inline
 * content — code that happens to contain `<div>` is code, and running it
 * through the inline sanitizer would silently delete it.
 */
export const codeBlock: BlockDefinition = {
    type: BLOCK_TYPE.Code,
    content: 'inline',
    defaultAttrs: { language: '' },
    tags: ['pre'],
    descriptor: {
        defaultLabel: 'Code',
        keywords: ['snippet', 'pre', 'monospace', 'syntax'],
        group: BLOCK_GROUP.Advanced,
        order: 20
    },
    toHtml: (block, ctx) => {
        const language = ctx.text(block.attrs['language']);
        const className = language
            ? ` class="language-${ctx.attr(language)}"`
            : '';
        return `<pre><code${className}>${block.html}</code></pre>`;
    },
    fromHtml: (element, ctx) => {
        const code = element.children.find(
            (node) => isElement(node) && node.tag === 'code'
        ) as HtmlElement | undefined;
        const language = /language-([\w+-]+)/.exec(
            code?.attrs['class'] ?? ''
        )?.[1];
        return ctx.block(BLOCK_TYPE.Code, {
            html: escapeHtmlText(nodeText((code ?? element).children)),
            attrs: { language: language ?? '' }
        });
    }
};

/**
 * A collapsible section: the block's own text is the summary, its `children`
 * are the body. `<details>`/`<summary>` is the native element for exactly this,
 * so the stored HTML collapses on a live site with no JavaScript at all.
 */
export const toggleBlock: BlockDefinition = {
    type: BLOCK_TYPE.Toggle,
    content: 'inline',
    defaultAttrs: { open: false },
    tags: ['details'],
    descriptor: {
        defaultLabel: 'Toggle',
        keywords: ['collapse', 'accordion', 'details', 'expand'],
        group: BLOCK_GROUP.Advanced,
        order: 21
    },
    toHtml: (block, ctx) => {
        const open = block.attrs['open'] === true ? ' open' : '';
        const body = ctx.children(block.children);
        return `<details${open}><summary>${ctx.inline(block.html)}</summary>${body}</details>`;
    },
    fromHtml: (element, ctx) => {
        const summary = element.children.find(
            (node) => isElement(node) && node.tag === 'summary'
        ) as HtmlElement | undefined;
        const body = element.children.filter((node) => node !== summary);
        return ctx.block(BLOCK_TYPE.Toggle, {
            html: summary ? ctx.inline(summary.children) : '',
            attrs: { open: element.attrs['open'] !== undefined },
            children: ctx.children(body)
        });
    }
};

/** A side-by-side layout. Holds only {@link columnBlock} children. */
export const columnsBlock: BlockDefinition = {
    type: BLOCK_TYPE.Columns,
    content: 'container',
    tags: ['div', 'section'],
    match: (element) => element.attrs['data-block'] === BLOCK_TYPE.Columns,
    descriptor: {
        defaultLabel: 'Columns',
        keywords: ['layout', 'grid', 'side by side', 'split'],
        group: BLOCK_GROUP.Advanced,
        order: 22
    },
    toHtml: (block, ctx) =>
        `<div data-block="${BLOCK_TYPE.Columns}">${ctx.children(block.children)}</div>`,
    fromHtml: (element, ctx) => {
        const children = ctx.children(element.children);
        // A layout with nothing in it is not a layout — drop it and keep
        // whatever it held, so an import can't leave empty scaffolding behind.
        return children.length === 0
            ? null
            : ctx.block(BLOCK_TYPE.Columns, { children });
    }
};

/** One column of a {@link columnsBlock}. Not offered in the slash menu. */
export const columnBlock: BlockDefinition = {
    type: BLOCK_TYPE.Column,
    content: 'container',
    tags: ['div', 'section'],
    match: (element) => element.attrs['data-block'] === BLOCK_TYPE.Column,
    toHtml: (block, ctx) => {
        const width = Number(block.attrs['width']);
        const widthAttr = Number.isFinite(width)
            ? ` data-width="${ctx.attr(String(width))}"`
            : '';
        return `<div data-block="${BLOCK_TYPE.Column}"${widthAttr}>${ctx.children(block.children)}</div>`;
    },
    fromHtml: (element, ctx) =>
        ctx.block(BLOCK_TYPE.Column, {
            attrs: { width: Number(element.attrs['data-width']) || null },
            children: ctx.children(element.children)
        })
};
