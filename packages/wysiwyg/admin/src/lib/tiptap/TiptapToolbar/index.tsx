import { defineMessages, useIntl } from 'react-intl';
import { useWysiwyg } from '../tiptapContext';
import { TiptapInsertMenu } from '../TiptapInsertMenu';
import { TiptapInlineControls } from '../TiptapInlineControls';

// --- The Simple Editor template's primitives and controls -------------------
import {
    Toolbar,
    ToolbarGroup,
    ToolbarSeparator
} from '../../../tiptap-ui/components/tiptap-ui-primitive/toolbar';
import { Spacer } from '../../../tiptap-ui/components/tiptap-ui-primitive/spacer';
import { HeadingDropdownMenu } from '../../../tiptap-ui/components/tiptap-ui/heading-dropdown-menu';
import { ListDropdownMenu } from '../../../tiptap-ui/components/tiptap-ui/list-dropdown-menu';
import { BlockquoteButton } from '../../../tiptap-ui/components/tiptap-ui/blockquote-button';
import { CodeBlockButton } from '../../../tiptap-ui/components/tiptap-ui/code-block-button';
import { MarkButton } from '../../../tiptap-ui/components/tiptap-ui/mark-button';
import { TextAlignButton } from '../../../tiptap-ui/components/tiptap-ui/text-align-button';
import { UndoRedoButton } from '../../../tiptap-ui/components/tiptap-ui/undo-redo-button';
import { LinkPopover } from '../../../tiptap-ui/components/tiptap-ui/link-popover';

const messages = defineMessages({
    label: { id: 'wysiwyg.toolbar.label', defaultMessage: 'Editor toolbar' }
});

/**
 * The persistent toolbar, shown when the editor owns the work area.
 *
 * This is the Simple Editor template's `MainToolbarContent`, in its order and
 * built from its components, with three deliberate departures.
 *
 * **No theme toggle.** The template ships one because it is a standalone demo;
 * here the admin app owns the theme, and a second control that disagrees with
 * the one in the sidebar is worse than none.
 *
 * **Colour and typography are ours, not the template's
 * `ColorHighlightPopover`.** Upstream's palette is built from its own CSS
 * custom properties, and a `var(--tt-color-highlight-green)` in a `<mark>` is
 * a value the sanitizer drops — an author would pick a colour, watch it apply,
 * and lose it on save. Ours stores a palette *name* the delivery surface can
 * map, with a hex as the documented exception.
 *
 * **Insert is ours**, because the blocks it offers — table, columns, callout,
 * toggle, embed — are ours; the template has no equivalent.
 *
 * Everything else is upstream's and works untouched, including the alignment
 * buttons: they look for an extension named `textAlign` with a `setTextAlign`
 * command, which is exactly what `blockAlign.ts` now configures.
 */
export function TiptapToolbar() {
    const intl = useIntl();
    const { editor } = useWysiwyg();
    if (!editor) return null;

    return (
        <Toolbar
            aria-label={intl.formatMessage(messages.label)}
            // Wrapping, where the template scrolls. Its toolbar is one fixed
            // row with `overflow-x: auto`, which is right for a full-width
            // page and wrong for a work area beside a properties rail: the
            // controls at the end are simply off the edge, with no scrollbar
            // an author would think to look for.
            className="border-border bg-background/95 sticky top-0 z-20 !h-auto !flex-wrap gap-y-1 border-b py-1 backdrop-blur"
        >
            <ToolbarGroup>
                <UndoRedoButton action="undo" />
                <UndoRedoButton action="redo" />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
                <HeadingDropdownMenu levels={[1, 2, 3, 4, 5, 6]} />
                <ListDropdownMenu
                    types={['bulletList', 'orderedList', 'taskList']}
                />
                <BlockquoteButton />
                <CodeBlockButton />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
                <MarkButton type="bold" />
                <MarkButton type="italic" />
                <MarkButton type="underline" />
                <MarkButton type="strike" />
                <MarkButton type="code" />
                <LinkPopover />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
                <MarkButton type="superscript" />
                <MarkButton type="subscript" />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
                <TextAlignButton align="left" />
                <TextAlignButton align="center" />
                <TextAlignButton align="right" />
                <TextAlignButton align="justify" />
            </ToolbarGroup>

            <ToolbarSeparator />

            {/* Ours, for the reasons in the note above. */}
            <ToolbarGroup>
                <TiptapInlineControls colorAndTypeOnly />
            </ToolbarGroup>

            <ToolbarSeparator />

            <ToolbarGroup>
                <TiptapInsertMenu />
            </ToolbarGroup>

            <Spacer />
        </Toolbar>
    );
}
