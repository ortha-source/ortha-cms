/**
 * The editor's document model — a **tree of blocks**, the Notion/Coda shape.
 *
 * Deliberately small: a block is an id, a `type` string, its own inline HTML,
 * a bag of JSON-serializable `attrs`, and (for container blocks) `children`.
 * Everything a block type means — how it renders, how it serializes, how it
 * parses back — lives in its {@link BlockDefinition}, never in this shape. That
 * is what makes the editor extensible: a new block type is a new definition,
 * not a new branch in the model.
 *
 * The model is an **editing** representation. The stored/delivered value is
 * always HTML (`serializeDocument`), so nothing downstream has to understand it.
 */

/** A value a block attribute may hold — JSON-serializable scalars only. */
export type BlockAttrValue = string | number | boolean | null;

/** A block's attribute bag (heading level, code language, image src, …). */
export type BlockAttrs = Readonly<Record<string, BlockAttrValue>>;

/** One node of the document tree. */
export interface WysiwygBlock {
    /**
     * Editor-local identity — stable across edits so React keys and the
     * caret/selection can track a block through a re-render. **Not** serialized
     * into the HTML: a document round-tripped through HTML gets fresh ids.
     */
    readonly id: string;
    /** Block-type identifier — the key into the {@link BlockSchema}. */
    readonly type: string;
    /**
     * The block's own editable text as **inline** HTML (`<strong>`, `<em>`,
     * `<a>`, `<code>`, `<br>`, …). Empty for `void`/`container` blocks.
     */
    readonly html: string;
    /** Type-specific attributes (`level`, `checked`, `language`, `src`, …). */
    readonly attrs: BlockAttrs;
    /** Nested blocks — non-empty only for `container` blocks. */
    readonly children: readonly WysiwygBlock[];
}

/** A whole document: an ordered list of top-level blocks. */
export interface WysiwygDocument {
    readonly blocks: readonly WysiwygBlock[];
}

/**
 * A block's position in the tree: the index at each depth, root-first. `[2]` is
 * the third top-level block; `[2, 0]` is that block's first child. Paths are how
 * every tree operation addresses a block — an id lookup resolves to one first.
 */
export type BlockPath = readonly number[];

/** How a block type holds content — the one thing the editor branches on. */
export const BLOCK_CONTENT = {
    /** Editable inline text (paragraph, heading, list item, quote…). */
    Inline: 'inline',
    /** Holds child blocks instead of its own text (columns, toggle body…). */
    Container: 'container',
    /** No editable text at all (divider, image, embed). */
    Void: 'void'
} as const;

/** How a block type holds content. */
export type BlockContentKind =
    (typeof BLOCK_CONTENT)[keyof typeof BLOCK_CONTENT];
