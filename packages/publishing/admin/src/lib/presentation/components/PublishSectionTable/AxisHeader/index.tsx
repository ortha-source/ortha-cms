import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, TableHead } from '@orthacms/design-system';
import { PICK_STATE, type PickState } from '../../../../domain/publishPicks';
import type { PublishAxis } from '../../../../domain/types';

const messages = defineMessages({
    toggle: {
        id: 'publishing.axis.toggle',
        defaultMessage: 'Publish {axis} for every {type} record'
    },
    none: {
        id: 'publishing.axis.unavailable',
        defaultMessage: 'Nothing to publish in {axis}'
    }
});

/** A tri-state checkbox's `checked` for a pick state. */
export function checkedOf(state: PickState): boolean | 'indeterminate' {
    if (state === PICK_STATE.All) return true;
    return state === PICK_STATE.Some ? 'indeterminate' : false;
}

/**
 * One column header of a section: the axis's code (a locale slug) or label,
 * and a tri-state checkbox that picks or clears that axis for **every record
 * of the section** with something to publish in it. Disabled when no record
 * does — a column of missing or already-live entries.
 */
export function AxisHeader({
    axis,
    typeLabel,
    state,
    disabled,
    onToggle
}: {
    axis: PublishAxis;
    typeLabel: string;
    state: PickState;
    disabled: boolean;
    onToggle: (on: boolean) => void;
}) {
    const intl = useIntl();
    const unavailable = state === PICK_STATE.Unavailable;
    return (
        <TableHead className="text-center" title={axis.label}>
            <span className="inline-flex flex-col items-center gap-1 py-1">
                <span className="text-xs font-medium uppercase">
                    {axis.code ?? axis.label}
                </span>
                <Checkbox
                    checked={checkedOf(state)}
                    disabled={unavailable || disabled}
                    // A partly-picked column completes on click, the way the
                    // records table's select-all does.
                    onCheckedChange={() => onToggle(state !== PICK_STATE.All)}
                    aria-label={intl.formatMessage(
                        unavailable ? messages.none : messages.toggle,
                        { axis: axis.label, type: typeLabel }
                    )}
                />
            </span>
        </TableHead>
    );
}
