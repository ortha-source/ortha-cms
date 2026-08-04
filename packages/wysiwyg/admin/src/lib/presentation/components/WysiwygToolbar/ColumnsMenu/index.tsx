import { defineMessages, useIntl } from 'react-intl';
import type { Editor } from '@tiptap/react';
import { Columns3 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { COLUMN_COUNTS } from '../../../../domain/constants';
import { useLiveEditorState } from '../../../hooks/useLiveEditorState';
import { ToolbarMenuTrigger } from '../ToolbarMenuTrigger';

const messages = defineMessages({
    label: { id: 'wysiwyg.columns.label', defaultMessage: 'Columns' },
    count: {
        id: 'wysiwyg.columns.count',
        defaultMessage: '{count, plural, one {# column} other {# columns}}'
    },
    remove: {
        id: 'wysiwyg.columns.remove',
        defaultMessage: 'Merge back to one column'
    }
});

/** The radio value used when the caret is not inside a column layout. */
const NONE = '';

/**
 * Lays the content out in two to four side-by-side columns, or reshapes the
 * layout the caret is already inside. Shrinking a layout folds the dropped
 * columns' blocks into the last kept one rather than deleting them — see the
 * `columnBlock` node's `setColumns`.
 */
export function ColumnsMenu({ editor }: { editor: Editor }) {
    const intl = useIntl();
    const current = useLiveEditorState(
        editor,
        (instance) => {
            if (!instance.isActive('columnBlock')) return NONE;
            const count = instance.getAttributes('columnBlock')['count'];
            return typeof count === 'number' ? String(count) : NONE;
        },
        NONE
    );

    const label = intl.formatMessage(messages.label);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ToolbarMenuTrigger
                    label={label}
                    icon={Columns3}
                    active={current !== NONE}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuRadioGroup
                    value={current}
                    onValueChange={(next) =>
                        editor.chain().focus().setColumns(Number(next)).run()
                    }
                >
                    {COLUMN_COUNTS.map((count) => (
                        <DropdownMenuRadioItem
                            key={count}
                            value={String(count)}
                        >
                            {intl.formatMessage(messages.count, { count })}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {current !== NONE ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() =>
                                editor.chain().focus().unsetColumns().run()
                            }
                        >
                            {intl.formatMessage(messages.remove)}
                        </DropdownMenuItem>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
