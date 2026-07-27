/**
 * Block constructors. Every block in the system is built here, so the
 * invariants — an id is always present, `attrs`/`children` are never
 * `undefined` — hold by construction rather than by every call site
 * remembering them.
 */

import type { BlockAttrs, WysiwygBlock, WysiwygDocument } from './types';

/** Monotonic counter — cheap uniqueness within one editor session. */
let sequence = 0;

/**
 * A fresh block id. Editor-local only (ids never reach the serialized HTML),
 * so a counter plus a random suffix is enough — no crypto dependency, and it
 * works identically in Node and the browser.
 */
export function createBlockId(): string {
    sequence += 1;
    return `b${sequence.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Optional overrides when building a block. */
export interface CreateBlockInit {
    id?: string;
    html?: string;
    attrs?: BlockAttrs;
    children?: readonly WysiwygBlock[];
}

/** Builds a block of `type`, filling every field the model requires. */
export function createBlock(
    type: string,
    init: CreateBlockInit = {}
): WysiwygBlock {
    return {
        id: init.id ?? createBlockId(),
        type,
        html: init.html ?? '',
        attrs: init.attrs ?? {},
        children: init.children ?? []
    };
}

/** The block type every empty document (and every plain Enter) falls back to. */
export const PARAGRAPH_TYPE = 'paragraph';

/** A paragraph block holding `html`. */
export function createParagraph(html = ''): WysiwygBlock {
    return createBlock(PARAGRAPH_TYPE, { html });
}

/**
 * A document is never truly empty — an editor with no blocks has nowhere to put
 * the caret — so "empty" means one blank paragraph.
 */
export function createEmptyDocument(): WysiwygDocument {
    return { blocks: [createParagraph()] };
}

/**
 * The blocks a document should render with: its own, or a single blank
 * paragraph when it has none. Applied on every parse so the editor can assume
 * at least one editable block exists.
 */
export function withFallbackBlock(
    blocks: readonly WysiwygBlock[]
): readonly WysiwygBlock[] {
    return blocks.length > 0 ? blocks : [createParagraph()];
}
