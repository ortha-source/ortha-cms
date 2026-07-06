import { defineMessages, useIntl } from 'react-intl';
import { isLongForm } from '../../../../types/recordDraft';
import type { FieldState } from '../../../../hooks/useRecordEditor';
import { OutlineRow } from '../OutlineRow';
import { OutlineGroup } from '../OutlineGroup';

const messages = defineMessages({
    groupProperties: {
        id: 'content.record.outline.groupProperties',
        defaultMessage: 'Properties'
    },
    groupContent: {
        id: 'content.record.outline.groupContent',
        defaultMessage: 'Content'
    }
});

/** A field is a "problem" (always shown) if it's required or currently blocking. */
function isProblem(state: FieldState): boolean {
    return state.field.required || state.blocking;
}

/**
 * The outline body for large schemas: required/invalid rows stay pinned at the
 * top, and the rest fold into two collapsible groups (Properties, Content) so a
 * 40-field record is scannable without a wall of rows.
 */
export function ProblemsFirst({
    fieldStates,
    activeKey,
    onJump
}: {
    fieldStates: FieldState[];
    activeKey?: string;
    onJump: (key: string) => void;
}) {
    const intl = useIntl();
    const problems = fieldStates.filter(isProblem);
    const restScalars = fieldStates.filter(
        (state) => !isProblem(state) && !isLongForm(state.field.type)
    );
    const restLong = fieldStates.filter(
        (state) => !isProblem(state) && isLongForm(state.field.type)
    );

    return (
        <>
            {problems.map((state) => (
                <OutlineRow
                    key={state.field.key}
                    state={state}
                    active={state.field.key === activeKey}
                    onJump={onJump}
                />
            ))}
            <OutlineGroup
                label={intl.formatMessage(messages.groupProperties)}
                items={restScalars}
                activeKey={activeKey}
                onJump={onJump}
            />
            <OutlineGroup
                label={intl.formatMessage(messages.groupContent)}
                items={restLong}
                activeKey={activeKey}
                onJump={onJump}
            />
        </>
    );
}
