import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import { cn } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';
import { BlockList } from '../../BlockList';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.toggle.label',
        defaultMessage: 'Toggle title'
    },
    placeholder: {
        id: 'wysiwyg.block.toggle.placeholder',
        defaultMessage: 'Toggle'
    },
    expand: {
        id: 'wysiwyg.block.toggle.expand',
        defaultMessage: 'Show the toggle contents'
    },
    collapse: {
        id: 'wysiwyg.block.toggle.collapse',
        defaultMessage: 'Hide the toggle contents'
    }
});

/**
 * A collapsible section: this block's text is the summary, its children are the
 * body. Open/closed is stored (`open`), so a document reopens the way the
 * author left it — and serializes to `<details open>`, which collapses on a
 * live site with no JavaScript at all.
 */
export function ToggleBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const open = block.attrs['open'] === true;

    return (
        <div className="my-1">
            <div className="flex items-start gap-1">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-label={intl.formatMessage(
                        open ? messages.collapse : messages.expand
                    )}
                    className="hover:bg-muted mt-1.5 rounded p-0.5"
                    onClick={() => commands.setAttrs(path, { open: !open })}
                >
                    <ChevronRight
                        aria-hidden
                        className={cn(
                            'text-muted-foreground size-4 transition-transform',
                            open && 'rotate-90'
                        )}
                    />
                </button>
                <InlineEditable
                    path={path}
                    html={block.html}
                    placeholder={intl.formatMessage(messages.placeholder)}
                    ariaLabel={intl.formatMessage(messages.label)}
                    className="flex-1 py-1 leading-7 font-medium"
                />
            </div>
            {open && block.children.length > 0 && (
                <BlockList
                    blocks={block.children}
                    basePath={path}
                    className={cn(
                        'border-border ml-3 border-l pl-3',
                        readOnly && 'ml-3'
                    )}
                />
            )}
        </div>
    );
}
