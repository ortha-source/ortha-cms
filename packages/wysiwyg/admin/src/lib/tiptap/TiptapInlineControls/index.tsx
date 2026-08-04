import { useEditorState } from '@tiptap/react';
import { COLOR_MARK, TYPOGRAPHY_MARK } from '@ortha-cms/wysiwyg-core';
import { LinkControl } from '../../menus/LinkControl';
import { ColorControl } from '../../menus/ColorControl';
import { TypographyControl } from '../../menus/TypographyControl';
import { useWysiwyg } from '../tiptapContext';

/**
 * Link, colour and typography — the three controls both toolbars need.
 *
 * The controls themselves are the ones the old editor used, unchanged: they are
 * presentational, and what they present (a named palette rather than a colour
 * wheel, roles and steps rather than a font menu and a point picker) is a
 * product decision that survived the move to TipTap intact. What changed is
 * everything behind them — four `setMark` commands instead of hand-written
 * range surgery, and no `commitActiveHtml()` afterwards, because a command is
 * already a transaction and there is no DOM the model has to be re-read from.
 *
 * They keep saving and restoring the DOM selection before their overlays take
 * focus, which is now belt and braces: TipTap holds the selection in editor
 * state, and `focus()` writes it back over whatever the browser did. Left in
 * place because the controls are shared with nothing else, and a saved range
 * that is immediately overwritten costs nothing.
 */
export function TiptapInlineControls() {
    const { editor } = useWysiwyg();

    const state = useEditorState({
        editor,
        selector: ({ editor: instance }) =>
            instance
                ? {
                      href:
                          (instance.getAttributes('link')['href'] as
                              | string
                              | undefined) ?? null,
                      color:
                          (instance.getAttributes('textColor')['value'] as
                              | string
                              | undefined) ?? null,
                      highlight:
                          (instance.getAttributes('textHighlight')['value'] as
                              | string
                              | undefined) ?? null,
                      font:
                          (instance.getAttributes('fontRole')['value'] as
                              | string
                              | undefined) ?? null,
                      size:
                          (instance.getAttributes('textSize')['value'] as
                              | string
                              | undefined) ?? null
                  }
                : null
    });

    if (!editor || !state) return null;

    return (
        <>
            <LinkControl
                href={state.href}
                onApply={(url) =>
                    editor
                        .chain()
                        .focus()
                        .extendMarkRange('link')
                        .setLink({ href: url })
                        .run()
                }
                onRemove={() =>
                    editor
                        .chain()
                        .focus()
                        .extendMarkRange('link')
                        .unsetLink()
                        .run()
                }
            />
            <ColorControl
                color={state.color}
                highlight={state.highlight}
                onPick={(mark, value) =>
                    mark === COLOR_MARK.Text
                        ? editor.chain().focus().setTextColor(value).run()
                        : editor.chain().focus().setHighlight(value).run()
                }
            />
            <TypographyControl
                font={state.font}
                size={state.size}
                onPick={(mark, value) =>
                    mark === TYPOGRAPHY_MARK.Font
                        ? editor.chain().focus().setFontRole(value).run()
                        : editor.chain().focus().setTextSize(value).run()
                }
            />
        </>
    );
}
