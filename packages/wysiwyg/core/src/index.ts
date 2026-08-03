/**
 * Public API of `@ortha-cms/wysiwyg-core` — the runtime-agnostic half of the
 * Ortha block editor.
 *
 * Pure TypeScript with **zero dependencies** and no DOM: the document model,
 * the extensible block schema, and the HTML pipeline (parse → sanitize →
 * serialize). The React editor (`@ortha-cms/wysiwyg-admin`) renders this model;
 * the server uses the same pipeline to canonicalize and sanitize what it
 * stores. One definition of what the HTML means, applied on both sides.
 */

// ── Document model ────────────────────────────────────────────────────────
export { BLOCK_CONTENT } from './lib/document/types';
export type {
    BlockAttrValue,
    BlockAttrs,
    BlockContentKind,
    BlockPath,
    WysiwygBlock,
    WysiwygDocument
} from './lib/document/types';
export {
    PARAGRAPH_TYPE,
    createBlock,
    createBlockId,
    createEmptyDocument,
    createParagraph,
    withFallbackBlock
} from './lib/document/factory';
export type { CreateBlockInit } from './lib/document/factory';
export {
    blockAt,
    blockRangeBetween,
    flattenBlocks,
    insertAt,
    isDescendantPath,
    isSamePath,
    moveBlock,
    nextPath,
    parentPath,
    pathAfter,
    pathOfBlock,
    previousPath,
    removeAt,
    replaceAt,
    updateAt
} from './lib/document/tree';
export type { BlockEntry } from './lib/document/tree';

// ── Block schema (the extension point) ────────────────────────────────────
export type {
    BlockDefinition,
    BlockDescriptor,
    BlockParseContext,
    BlockSerializeContext,
    BlockWrapper
} from './lib/schema/block-definition';
export { createBlockSchema, extendBlockSchema } from './lib/schema/schema';
export type { BlockSchema } from './lib/schema/schema';
export {
    BLOCK_ALIGN,
    BLOCK_ALIGNS,
    BLOCK_GROUP,
    BLOCK_TYPE,
    CALLOUT_TONE,
    CALLOUT_TONES,
    HEADING_LEVELS,
    INLINE_COLOR,
    INLINE_COLORS,
    MEDIA_SIZE,
    MEDIA_SIZES
} from './lib/schema/block-types';
export type {
    BlockAlign,
    BuiltInBlockType,
    CalloutTone,
    HeadingLevel,
    InlineColor,
    MediaSize
} from './lib/schema/block-types';
export {
    DEFAULT_BLOCK_DEFINITIONS,
    DEFAULT_BLOCK_SCHEMA,
    bulletedListBlock,
    calloutBlock,
    codeBlock,
    columnBlock,
    columnsBlock,
    dividerBlock,
    embedBlock,
    headingBlock,
    createTable,
    createTableCell,
    createTableRow,
    imageBlock,
    isHeaderRow,
    numberedListBlock,
    paragraphBlock,
    quoteBlock,
    tableBlock,
    tableCellBlock,
    tableRowBlock,
    todoBlock,
    toggleBlock
} from './lib/schema/built-in';

// ── HTML pipeline ─────────────────────────────────────────────────────────
export { parseHtmlNodes } from './lib/html/parse-nodes';
export { isElement, isText, VOID_TAGS } from './lib/html/node';
export type { HtmlElement, HtmlNode, HtmlText } from './lib/html/node';
export {
    DOCUMENT_SANITIZE_POLICY,
    INLINE_SANITIZE_POLICY,
    isHexColor,
    toHexColor,
    sanitizeHtml,
    sanitizeInlineHtml,
    sanitizeNodes,
    serializeNodes
} from './lib/html/sanitize';
export type { SanitizePolicy } from './lib/html/sanitize';
export {
    escapeHtmlAttribute,
    escapeHtmlText,
    decodeBasicEntities
} from './lib/html/escape';
export {
    INLINE_MARK_TAG,
    isBlockMarked,
    toggleBlockMark
} from './lib/html/inline-marks';
export type { InlineMarkTag } from './lib/html/inline-marks';
export {
    COLOR_MARK,
    COLOR_MARK_TAG,
    colorOrNull,
    isColorSet
} from './lib/html/inline-colors';
export type { ColorMark } from './lib/html/inline-colors';
export { serializeBlocks, serializeDocument } from './lib/html/serialize';
export type { SerializeOptions } from './lib/html/serialize';
export { parseBlocks, parseDocument } from './lib/html/parse-document';
export type { ParseOptions } from './lib/html/parse-document';
export { normalizeWysiwygHtml } from './lib/html/normalize';

// ── Plain text ────────────────────────────────────────────────────────────
export {
    htmlExcerpt,
    htmlTextLength,
    htmlToPlainText,
    isEmptyHtml,
    nodeText
} from './lib/text/plain-text';
