import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { isLongForm } from '../../../../types/recordDraft';
import type { FieldState } from '../../../../hooks/useRecordEditor';

const messages = defineMessages({
    groupProperties: {
        id: 'content.record.groupProperties',
        defaultMessage: 'Properties'
    },
    groupContent: {
        id: 'content.record.groupContent',
        defaultMessage: 'Content'
    }
});

/**
 * The island's grouped layout (used above the group threshold): scalars under a
 * **Properties** separator, long-form fields under **Content**, each preserving
 * schema order. The `render` callback draws each field so grouping stays a pure
 * layout concern.
 */
export function GroupedFields({
    fieldStates,
    render
}: {
    fieldStates: FieldState[];
    render: (state: FieldState) => ReactNode;
}) {
    const intl = useIntl();
    const scalars = fieldStates.filter(
        (state) => !isLongForm(state.field.type)
    );
    const longForm = fieldStates.filter((state) =>
        isLongForm(state.field.type)
    );

    const groups = [
        { label: intl.formatMessage(messages.groupProperties), items: scalars },
        { label: intl.formatMessage(messages.groupContent), items: longForm }
    ].filter((group) => group.items.length > 0);

    return (
        <div className="flex flex-col gap-7">
            {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-[22px]">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.label}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                            {group.items.length}
                        </span>
                        <div className="h-px flex-1 bg-border" />
                    </div>
                    {group.items.map(render)}
                </div>
            ))}
        </div>
    );
}
