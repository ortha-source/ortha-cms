/**
 * Public API of `@ortha-cms/wysiwyg-admin` — the React block editor.
 *
 * The default export surface is deliberately one component: `WysiwygEditor` is
 * a controlled form control whose value is HTML, so a consumer needs no editor
 * concepts at all to use it. Everything below it is exported for the other
 * case — extending the editor, which means adding a TipTap extension to
 * `buildExtensions` and, if it needs a control, a component from the Tiptap UI
 * template's primitives to the toolbar.
 */

export { WysiwygField } from './lib/field/WysiwygField';
export type { WysiwygFieldProps } from './lib/field/WysiwygField';
export { TiptapEditor as WysiwygEditor } from './lib/tiptap/TiptapEditor';
export type { TiptapEditorProps as WysiwygEditorProps } from './lib/tiptap/TiptapEditor';

// ── Extending the schema ──────────────────────────────────────────────────
export { buildExtensions } from './lib/tiptap/extensions';
export { useWysiwyg } from './lib/tiptap/tiptapContext';
export type { TiptapContextValue } from './lib/tiptap/tiptapContext';
export { WysiwygPreviewCard } from './lib/field/WysiwygPreviewCard';

// ── Rendering a stored value ──────────────────────────────────────────────
export { WysiwygContent } from './lib/render/WysiwygContent';
export { WYSIWYG_INLINE_PROSE, WYSIWYG_PROSE } from './lib/render/wysiwygProse';

// ── The host's media library ──────────────────────────────────────────────
export type {
    WysiwygMediaAsset,
    WysiwygMediaPort
} from './lib/media/wysiwygMedia';
