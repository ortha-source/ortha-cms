import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, cn } from '@ortha-cms/design-system';
import { useEditor } from '../../../editor/editorContext';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.todo.label',
        defaultMessage: 'To-do item'
    },
    toggle: {
        id: 'wysiwyg.block.todo.toggle',
        defaultMessage: 'Mark this item done'
    }
});

/** A checkable to-do item. */
export function TodoBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const { commands, readOnly } = useEditor();
    const checked = block.attrs['checked'] === true;

    return (
        <div className="flex items-start gap-2 py-0.5">
            <Checkbox
                checked={checked}
                disabled={readOnly}
                aria-label={intl.formatMessage(messages.toggle)}
                onCheckedChange={() => commands.toggleChecked(path)}
                className="mt-2 shrink-0"
            />
            <InlineEditable
                path={path}
                html={block.html}
                ariaLabel={intl.formatMessage(messages.label)}
                className={cn(
                    'flex-1 py-1 leading-7',
                    // A done item is struck through and dimmed. It stays fully
                    // editable — crossing something off isn't archiving it.
                    checked && 'text-muted-foreground line-through'
                )}
            />
        </div>
    );
}
