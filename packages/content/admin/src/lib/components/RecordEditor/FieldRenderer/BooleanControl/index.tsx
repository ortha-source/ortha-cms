import { defineMessages, useIntl } from 'react-intl';
import {
    SegmentedControl,
    SegmentedControlItem
} from '@ortha-cms/design-system';
import type { FieldControlProps } from '../fieldControl';

const messages = defineMessages({
    enabled: { id: 'content.record.enabled', defaultMessage: 'Enabled' },
    disabled: { id: 'content.record.disabled', defaultMessage: 'Disabled' },
    booleanLabel: {
        id: 'content.record.booleanLabel',
        defaultMessage: '{label} — enabled or disabled'
    }
});

/** Two-option segmented control for a `boolean`. */
export function BooleanControl({
    field,
    value,
    inputId,
    describedById,
    onChange,
    onBlur
}: FieldControlProps) {
    const intl = useIntl();
    const selected =
        value === true ? 'on' : value === false ? 'off' : undefined;
    return (
        <SegmentedControl
            id={inputId}
            value={selected}
            aria-label={intl.formatMessage(messages.booleanLabel, {
                label: field.label
            })}
            aria-describedby={describedById}
            onValueChange={(next) =>
                onChange(next === 'on' ? true : next === 'off' ? false : null)
            }
            onBlur={onBlur}
            className="h-9 w-full justify-stretch rounded-lg [&>*]:flex-1"
        >
            <SegmentedControlItem value="on">
                {intl.formatMessage(messages.enabled)}
            </SegmentedControlItem>
            <SegmentedControlItem value="off">
                {intl.formatMessage(messages.disabled)}
            </SegmentedControlItem>
        </SegmentedControl>
    );
}
