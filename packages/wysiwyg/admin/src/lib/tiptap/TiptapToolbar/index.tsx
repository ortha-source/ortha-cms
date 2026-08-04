import { defineMessages, useIntl } from 'react-intl';
import { INLINE_COLOR } from '@ortha-cms/wysiwyg-core';
import { useWysiwyg } from '../tiptapContext';
import { MediaLibraryButton } from '../MediaLibraryButton';

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
import { ColorHighlightPopover } from '../../../tiptap-ui/components/tiptap-ui/color-highlight-popover';
import { MarkButton } from '../../../tiptap-ui/components/tiptap-ui/mark-button';
import { TextAlignButton } from '../../../tiptap-ui/components/tiptap-ui/text-align-button';
import { UndoRedoButton } from '../../../tiptap-ui/components/tiptap-ui/undo-redo-button';
import { LinkPopover } from '../../../tiptap-ui/components/tiptap-ui/link-popover';

const messages = defineMessages({
    label: { id: 'wysiwyg.toolbar.label', defaultMessage: 'Editor toolbar' },
    gray: { id: 'wysiwyg.color.gray', defaultMessage: 'Gray' },
    brown: { id: 'wysiwyg.color.brown', defaultMessage: 'Brown' },
    orange: { id: 'wysiwyg.color.orange', defaultMessage: 'Orange' },
    yellow: { id: 'wysiwyg.color.yellow', defaultMessage: 'Yellow' },
    green: { id: 'wysiwyg.color.green', defaultMessage: 'Green' },
    blue: { id: 'wysiwyg.color.blue', defaultMessage: 'Blue' },
    purple: { id: 'wysiwyg.color.purple', defaultMessage: 'Purple' },
    pink: { id: 'wysiwyg.color.pink', defaultMessage: 'Pink' },
    red: { id: 'wysiwyg.color.red', defaultMessage: 'Red' }
});

/**
 * The highlight palette, as **names** rather than the template's
 * `var(--tt-color-highlight-…)`.
 *
 * The popover sets whatever `value` an entry carries, and that value is what
 * ends up in the document. A CSS variable is not something the sanitizer keeps
 * — nor something a delivery surface could resolve if it did — so the entries
 * carry the ten words core's vocabulary is written in, and the surface maps
 * them onto its own palette. They double as valid CSS colour keywords, which is
 * what draws the swatch.
 */
const HIGHLIGHTS = [
    INLINE_COLOR.Gray,
    INLINE_COLOR.Brown,
    INLINE_COLOR.Orange,
    INLINE_COLOR.Yellow,
    INLINE_COLOR.Green,
    INLINE_COLOR.Blue,
    INLINE_COLOR.Purple,
    INLINE_COLOR.Pink,
    INLINE_COLOR.Red
] as const;

/**
 * The toolbar — the Simple Editor template's `MainToolbarContent`, in its order
 * and built from its components.
 *
 * Two departures, both because the template is a standalone demo and this is a
 * field in a CMS.
 *
 * **No theme toggle.** The admin app owns the theme, and a second control that
 * disagrees with the one in the sidebar is worse than none.
 *
 * **The image button opens the media library**, where the template's uploads a
 * file. In this app an image is an asset the host already manages, and the port
 * it hands the editor offers one thing: pick one. Everything else about the
 * button is the template's.
 *
 * It wraps where the template scrolls. One fixed row with `overflow-x: auto` is
 * right for a full-width page and wrong for a work area beside a properties
 * rail: the last controls end up off the edge, behind a scrollbar nobody would
 * think to look for.
 */
export function TiptapToolbar() {
    const intl = useIntl();
    const { editor } = useWysiwyg();
    if (!editor) return null;

    return (
        <Toolbar
            aria-label={intl.formatMessage(messages.label)}
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
                <ColorHighlightPopover
                    colors={HIGHLIGHTS.map((name) => ({
                        label: intl.formatMessage(messages[name]),
                        value: name,
                        // The swatch's ring. The names double as CSS colour
                        // keywords, which is what draws both.
                        border: name
                    }))}
                />
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

            <ToolbarGroup>
                <MediaLibraryButton />
            </ToolbarGroup>

            <Spacer />
        </Toolbar>
    );
}
