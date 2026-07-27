/**
 * HTML → document. The inverse of `serializeDocument`, and deliberately more
 * forgiving than it: the input may be a value this editor wrote, a value an
 * older editor wrote, an import, or a paste out of another app.
 *
 * The order is fixed and matters — **parse, sanitize, then interpret**. Blocks
 * are only ever built from already-sanitized nodes, so no block type can be
 * tricked into carrying markup the policy rejects, however creative its
 * `fromHtml` is.
 */

import { createBlock, withFallbackBlock } from '../document/factory';
import type { WysiwygBlock, WysiwygDocument } from '../document/types';
import { DEFAULT_BLOCK_SCHEMA } from '../schema/built-in';
import { BLOCK_TYPE } from '../schema/block-types';
import type { BlockSchema } from '../schema/schema';
import type {
    BlockDefinition,
    BlockParseContext
} from '../schema/block-definition';
import { isElement, type HtmlElement, type HtmlNode } from './node';
import { parseHtmlNodes } from './parse-nodes';
import {
    DOCUMENT_SANITIZE_POLICY,
    INLINE_SANITIZE_POLICY,
    sanitizeNodes,
    serializeNodes
} from './sanitize';

/** Options for {@link parseDocument}. */
export interface ParseOptions {
    /** The block types in play. Defaults to the built-in set. */
    readonly schema?: BlockSchema;
}

/** Tags that belong *inside* a block rather than being one. */
const INLINE_TAGS: ReadonlySet<string> = new Set([
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'mark',
    'code',
    'sub',
    'sup',
    'a',
    'br',
    'span'
]);

/** Parses stored HTML into blocks. Never throws; never returns an empty list. */
export function parseBlocks(
    html: string,
    options: ParseOptions = {}
): readonly WysiwygBlock[] {
    const schema = options.schema ?? DEFAULT_BLOCK_SCHEMA;
    const nodes = sanitizeNodes(
        parseHtmlNodes(html ?? ''),
        DOCUMENT_SANITIZE_POLICY
    );
    return withFallbackBlock(nodesToBlocks(nodes, schema));
}

/** Parses stored HTML into a document. */
export function parseDocument(
    html: string,
    options: ParseOptions = {}
): WysiwygDocument {
    return { blocks: parseBlocks(html, options) };
}

/** The inline HTML of a node run — everything structural flattened away. */
function inlineOf(nodes: readonly HtmlNode[]): string {
    return serializeNodes(sanitizeNodes(nodes, INLINE_SANITIZE_POLICY));
}

/** The parse context handed to each definition's `fromHtml`. */
function parseContext(schema: BlockSchema): BlockParseContext {
    return {
        children: (nodes) => nodesToBlocks(nodes, schema),
        inline: inlineOf,
        block: (type, init = {}) =>
            createBlock(type, {
                html: init.html,
                attrs: {
                    ...(schema.get(type)?.defaultAttrs ?? {}),
                    ...(init.attrs ?? {})
                },
                children: init.children
            })
    };
}

/**
 * Turns a run of sibling nodes into blocks. Consecutive inline nodes are
 * gathered into one paragraph — a fragment like `hello <b>world</b>` has no
 * block element at all, and dropping it would lose the whole value.
 */
function nodesToBlocks(
    nodes: readonly HtmlNode[],
    schema: BlockSchema
): WysiwygBlock[] {
    const blocks: WysiwygBlock[] = [];
    let buffer: HtmlNode[] = [];

    const flush = () => {
        if (buffer.length === 0) return;
        const html = inlineOf(buffer);
        buffer = [];
        if (html.trim() === '') return;
        blocks.push(createBlock(BLOCK_TYPE.Paragraph, { html }));
    };

    for (const node of nodes) {
        if (!isElement(node) || INLINE_TAGS.has(node.tag)) {
            buffer.push(node);
            continue;
        }
        flush();
        blocks.push(...elementToBlocks(node, schema));
    }
    flush();
    return blocks;
}

/** The block(s) one block-level element produces. */
function elementToBlocks(
    element: HtmlElement,
    schema: BlockSchema
): WysiwygBlock[] {
    const context = parseContext(schema);

    // A wrapper (`<ul>`, `<ol>`) is not a block — it is a run of them.
    const wrapperDefinition = schema.matchWrapper(element);
    if (wrapperDefinition?.wrapper) {
        const itemTag = wrapperDefinition.wrapper.itemTag ?? 'li';
        return element.children
            .filter(
                (child): child is HtmlElement =>
                    isElement(child) && child.tag === itemTag
            )
            .flatMap((item) =>
                toBlockList(buildBlock(wrapperDefinition, item, context))
            );
    }

    const definition = schema.matchElement(element);
    if (definition) return toBlockList(buildBlock(definition, element, context));

    // An unrecognized container (a stray `<div>` from a paste) contributes its
    // *contents*, not itself — otherwise a wrapper nobody asked for would eat
    // the blocks inside it.
    if (element.children.some((child) => isElement(child) && !INLINE_TAGS.has(child.tag))) {
        return nodesToBlocks(element.children, schema);
    }
    const html = inlineOf(element.children);
    return html.trim() === ''
        ? []
        : [createBlock(BLOCK_TYPE.Paragraph, { html })];
}

/**
 * Runs a definition's `fromHtml`, or the default one — "a block of this type
 * carrying the element's inline content", which is correct for every simple
 * text block and keeps those definitions down to a single `toHtml`.
 */
function buildBlock(
    definition: BlockDefinition,
    element: HtmlElement,
    context: BlockParseContext
): WysiwygBlock | readonly WysiwygBlock[] | null {
    if (definition.fromHtml) return definition.fromHtml(element, context);
    return context.block(definition.type, {
        html: definition.content === 'void' ? '' : inlineOf(element.children),
        children:
            definition.content === 'container'
                ? context.children(element.children)
                : []
    });
}

/** Normalizes a `fromHtml` result to a list. */
function toBlockList(
    result: WysiwygBlock | readonly WysiwygBlock[] | null
): WysiwygBlock[] {
    if (result === null) return [];
    return Array.isArray(result) ? [...result] : [result as WysiwygBlock];
}
