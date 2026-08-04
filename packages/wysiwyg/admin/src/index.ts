export { WysiwygPlugin } from './lib/presentation/wysiwygPlugin';
export type { WysiwygAdminPlugin } from './lib/presentation/wysiwygPlugin';

// The `admin.widget` values a content schema can set on a `richtext` field to
// ask for — or opt out of — this editor.
//
// Nothing else is exported on purpose. The preview and the editor are behind a
// lazy import (see `wysiwygPlugin`), and re-exporting either from here would
// pull TipTap back into whatever chunk imports this module — which is the entry
// chunk, since the plugin factory has to run at boot.
export { WYSIWYG_WIDGET } from './lib/domain/constants';
