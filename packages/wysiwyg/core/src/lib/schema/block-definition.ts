/**
 * The **block definition** contract — the extension point the whole editor is
 * built on.
 *
 * A block type is not a branch in a `switch`; it is one object registered in a
 * {@link BlockSchema}. A definition owns three things and nothing else: how the
 * block behaves while editing (`content`, `defaultAttrs`), how it becomes HTML
 * (`toHtml`), and how HTML becomes it again (`tags`/`match`/`fromHtml`). The
 * admin package adds the fourth — how it *renders* in React — keyed by the same
 * `type`, so the model stays framework-free.
 *
 * Adding a block type is therefore: write a definition, register it, (add a
 * renderer). Nothing in the parser, serializer, or editor changes.
 */

import type {
    BlockAttrs,
    BlockContentKind,
    WysiwygBlock
} from '../document/types';
import type { HtmlElement, HtmlNode } from '../html/node';

/**
 * The wrapper a run of same-type blocks collapses into. List items are the
 * reason this exists: three bullets are **three blocks** in the model (so each
 * has its own caret, drag handle and menu) but must be **one `<ul>`** in the
 * HTML. Serialization groups them; parsing expands the wrapper back.
 */
export interface BlockWrapper {
    /** The wrapper element (`ul`, `ol`, …). */
    readonly tag: string;
    /** Attributes stamped on the wrapper — also its grouping discriminator. */
    readonly attrs?: Readonly<Record<string, string>>;
    /** The element one block becomes inside the wrapper. Defaults to `li`. */
    readonly itemTag?: string;
    /**
     * Which wrapper elements belong to *this* type, when several types share a
     * tag (a todo list and a bulleted list are both `<ul>`).
     */
    match?(element: HtmlElement): boolean;
}

/** What a definition may call while serializing one block. */
export interface BlockSerializeContext {
    /** Serializes child blocks — grouping, nesting and all. */
    children(blocks: readonly WysiwygBlock[]): string;
    /** Sanitizes a block's inline HTML down to the allowed marks. */
    inline(html: string): string;
    /** Escapes a value for a double-quoted attribute. */
    attr(value: string): string;
    /** Reads an attribute as a string, with a fallback. */
    text(value: unknown, fallback?: string): string;
}

/** What a definition may call while parsing one element. */
export interface BlockParseContext {
    /** Parses element children into blocks (containers). */
    children(nodes: readonly HtmlNode[]): WysiwygBlock[];
    /** Collects nodes as sanitized inline HTML (a block's own text). */
    inline(nodes: readonly HtmlNode[]): string;
    /** Builds a block of `type` with the definition's default attrs applied. */
    block(
        type: string,
        init?: {
            html?: string;
            attrs?: BlockAttrs;
            children?: readonly WysiwygBlock[];
        }
    ): WysiwygBlock;
}

/** Slash-menu metadata. The admin localizes the label and picks the icon. */
export interface BlockDescriptor {
    /** English fallback label, used when the admin has no translation. */
    readonly defaultLabel: string;
    /** Extra words the slash menu matches on ("bullet", "todo", "quote"). */
    readonly keywords?: readonly string[];
    /** Menu section — `basic` · `media` · `advanced`, or a custom one. */
    readonly group?: string;
    /** Sort order inside the group; lower first. */
    readonly order?: number;
}

/** One registered block type. */
export interface BlockDefinition {
    /** The `WysiwygBlock.type` this definition owns. */
    readonly type: string;
    /** How the block holds content — drives caret handling in the editor. */
    readonly content: BlockContentKind;
    /** Attributes a freshly-created block of this type starts with. */
    readonly defaultAttrs?: BlockAttrs;
    /** Grouping/wrapper behavior — list items and their kin. */
    readonly wrapper?: BlockWrapper;
    /** Slash-menu metadata; omit to keep the type out of the menu. */
    readonly descriptor?: BlockDescriptor;
    /**
     * Whether a plain Enter at the end of this block should continue the same
     * type (a list item) rather than start a paragraph. Defaults to `false`.
     */
    readonly continueOnEnter?: boolean;

    /** Serializes one block to HTML. The one authority for this type's output. */
    toHtml(block: WysiwygBlock, context: BlockSerializeContext): string;

    /** Element tags this definition claims while parsing. */
    readonly tags?: readonly string[];
    /** Narrows {@link tags} when several types share one (a `<figure>`). */
    match?(element: HtmlElement): boolean;
    /**
     * Builds the block(s) for a matched element. Defaults to "one block of this
     * type carrying the element's inline content", which is right for every
     * simple text block.
     */
    fromHtml?(
        element: HtmlElement,
        context: BlockParseContext
    ): WysiwygBlock | WysiwygBlock[] | null;
}
