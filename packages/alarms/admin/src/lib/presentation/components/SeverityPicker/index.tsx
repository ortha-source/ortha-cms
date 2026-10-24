import { useIntl } from 'react-intl';
import {
    SegmentedControl,
    SegmentedControlItem
} from '@orthacms/design-system';
import { ALARM_SEVERITIES, type AlarmSeverity } from '../../../types/alarm';
import { severityLook } from '../../severityLook';

/** Props for {@link SeverityPicker}. */
export type SeverityPickerProps = {
    /** The id of the visible label that names this control. */
    labelledBy: string;
    value: AlarmSeverity;
    onChange: (next: AlarmSeverity) => void;
    disabled?: boolean;
};

/**
 * An alarm's level as three segments — Error, Warning, Info — each with the
 * glyph it carries everywhere else, so the shape is learnt where it is chosen.
 *
 * A segmented control rather than a select: three options, all worth seeing at
 * once, and the choice is how loud the alarm is, not a value to look up. The
 * words and glyphs come from `severityLook`, the one place a severity becomes a
 * look. It is a Radix single-select toggle group, i.e. a `radiogroup` of
 * `radio`s with arrow-key movement; clicking the selected segment again would
 * deselect it there, which is ignored here — a level is never blank.
 */
export function SeverityPicker({
    labelledBy,
    value,
    onChange,
    disabled = false
}: SeverityPickerProps) {
    const intl = useIntl();
    return (
        <SegmentedControl
            variant="muted"
            className="self-start"
            aria-labelledby={labelledBy}
            value={value}
            disabled={disabled}
            onValueChange={(next) => {
                if (next) onChange(next as AlarmSeverity);
            }}
        >
            {ALARM_SEVERITIES.map((severity) => {
                const { Icon, label } = severityLook(severity);
                return (
                    <SegmentedControlItem key={severity} value={severity}>
                        <Icon aria-hidden="true" className="size-3.5" />
                        {intl.formatMessage(label)}
                    </SegmentedControlItem>
                );
            })}
        </SegmentedControl>
    );
}
