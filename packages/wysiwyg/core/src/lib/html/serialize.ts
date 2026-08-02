/**
 * Document → HTML. The output is the value the field stores and the delivery
 * API returns, so it is plain semantic HTML: no editor classes, no wrapper
 * `<div>`s, no ids, nothing a consumer has to strip before rendering it.
 *
 * The one non-obvious job here is **grouping**: a run of blocks whose
 * definition declares a {@link BlockWrapper} collapses into a single wrapper
 * element, which is how three bulleted-list blocks become one `<ul>`.
 */

import type { WysiwygBlock, WysiwygDocument } from '../document/types';
import { DEFAULT_BLOCK_SCHEMA } from '../schema/built-in';
import { BLOCK_ALIGN, BLOCK_TYPE } from '../schema/block-types';
import type { BlockSchema } from '../schema/schema';
import type {
    BlockDefinition,
    BlockSerializeContext
} from '../schema/block-definition';
import { escapeHtmlAttribute } from './escape';
import { sanitizeInlineHtml } from './sanitize';

/** Options for {@link serializeBlocks} / {@link serializeDocument}. */
export interface SerializeOptions {
    /** The block types in play. Defaults to the built-in set. */
    readonly schema?: BlockSchema;
}

/**
 * The definition used for a block whose type isn't registered. Rendering it as
 * a paragraph keeps the author's words on the page: a schema that lost a
 * plugin's custom block should degrade to text, never to silence.
 */
function fallbackDefinition(schema: BlockSchema): BlockDefinition {
    return (
        schema.get(BLOCK_TYPE.Paragraph) ?? {
            type: BLOCK_TYPE.Paragraph,
            content: 'inline',
            toHtml: (block, ctx) => `<p>${ctx.inline(block.html)}</p>`
        }
    );
}

/** Serializes a block list to HTML. */
export function serializeBlocks(
    blocks: readonly WysiwygBlock[],
    options: SerializeOptions = {}
): string {
    const schema = options.schema ?? DEFAULT_BLOCK_SCHEMA;
    const fallback = fallbackDefinition(schema);

    const context: BlockSerializeContext = {
        children: (children) => serializeBlocks(children, { schema }),
        inline: (html) => sanitizeInlineHtml(html ?? ''),
        attr: (value) => escapeHtmlAttribute(value),
        text: (value, fallbackText = '') =>
            value === null || value === undefined
                ? fallbackText
                : String(value),
        // Left is the absence of an alignment, so it is never written: an
        // untouched document carries no alignment markup at all, and a
        // paragraph someone centred and then un-centred goes back to being
        // byte-identical to one that was never touched.
        align: (block) => {
            const align = block.attrs['align'];
            if (typeof align !== 'string') return '';
            if (align === '' || align === BLOCK_ALIGN.Left) return '';
            return ` data-align="${escapeHtmlAttribute(align)}"`;
        }
    };

    let out = '';
    let index = 0;
    while (index < blocks.length) {
        const block = blocks[index];
        const definition = schema.get(block.type) ?? fallback;
        const wrapper = definition.wrapper;

        if (!wrapper) {
            out += definition.toHtml(block, context);
            index += 1;
            continue;
        }

        // Collect the whole run of same-type blocks so they share one wrapper.
        let items = '';
        while (index < blocks.length && blocks[index].type === block.type) {
            items += definition.toHtml(blocks[index], context);
            index += 1;
        }
        const attrs = Object.entries(wrapper.attrs ?? {})
            .map(([name, value]) => ` ${name}="${escapeHtmlAttribute(value)}"`)
            .join('');
        out += `<${wrapper.tag}${attrs}>${items}</${wrapper.tag}>`;
    }
    return out;
}

/** Serializes a whole document to HTML — the stored field value. */
export function serializeDocument(
    document: WysiwygDocument,
    options: SerializeOptions = {}
): string {
    return serializeBlocks(document.blocks, options);
}
