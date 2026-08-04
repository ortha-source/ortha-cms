/**
 * Public API of `@ortha-cms/wysiwyg-admin` — the React block editor.
 *
 * The default export surface is deliberately one component: `WysiwygEditor` is
 * a controlled form control whose value is HTML, so a consumer needs no editor
 * concepts at all to use it. Everything below it is exported for the other
 * case — extending the editor with a block type of your own, which is a
 * {@link BlockDefinition} (from `@ortha-cms/wysiwyg-core`) plus a
 * {@link BlockView} registered here under the same `type`.
 */

export { WysiwygField } from './lib/field/WysiwygField';
export type { WysiwygFieldProps } from './lib/field/WysiwygField';
export { TiptapEditor as WysiwygEditor } from './lib/tiptap/TiptapEditor';
export type { TiptapEditorProps as WysiwygEditorProps } from './lib/tiptap/TiptapEditor';

// ── Extending the schema ──────────────────────────────────────────────────
export { buildExtensions } from './lib/tiptap/extensions';
export { BLOCK_TYPES, filterBlockTypes } from './lib/tiptap/blockTypes';
export type { BlockTypeItem } from './lib/tiptap/blockTypes';
export { useWysiwyg } from './lib/tiptap/tiptapContext';
export type { TiptapContextValue } from './lib/tiptap/tiptapContext';
export { WysiwygPreviewCard } from './lib/field/WysiwygPreviewCard';

// ── Rendering a stored value ──────────────────────────────────────────────
export { WysiwygContent } from './lib/render/WysiwygContent';
export { WYSIWYG_INLINE_PROSE, WYSIWYG_PROSE } from './lib/render/wysiwygProse';

// ── Extending the editor ──────────────────────────────────────────────────
export type {
    BlockView,
    BlockViewProps,
    BlockViewRegistry
} from './lib/blocks/blockRegistry';
export { DEFAULT_BLOCK_VIEWS } from './lib/blocks/defaultBlockViews';
export { InlineEditable } from './lib/blocks/InlineEditable';
export type { EditableKeyHandlers } from './lib/blocks/InlineEditable';
export { BlockList } from './lib/blocks/BlockList';
export { useEditor } from './lib/editor/editorContext';
export type {
    EditorContextValue,
    SlashState
} from './lib/editor/editorContext';
export type { BlockCommands } from './lib/editor/useBlockCommands';
export type {
    WysiwygMediaAsset,
    WysiwygMediaPort
} from './lib/media/wysiwygMedia';
