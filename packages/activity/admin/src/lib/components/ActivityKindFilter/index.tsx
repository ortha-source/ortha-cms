import { defineMessages, useIntl } from 'react-intl';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@ortha-cms/design-system';
import { ACTIVITY_KIND_VALUES } from '@ortha-cms/activity-contract';
import { formatActivityAction } from '../../utils/activityMessages';

/** Intl descriptors for {@link ActivityKindFilter}, co-located. */
const messages = defineMessages({
    label: {
        id: 'activity.filter.kind.label',
        defaultMessage: 'Filter by action'
    },
    all: {
        id: 'activity.filter.kind.all',
        defaultMessage: 'All actions'
    }
});

/** Sentinel option value standing for "no kind filter". */
const ALL = 'all';

/**
 * The action (kind) filter: a single-select of every known event kind plus an
 * "All actions" reset. `value` is the empty string for no filter; selecting a
 * kind emits that kind, the reset emits an empty string.
 */
export function ActivityKindFilter({
    value,
    onChange
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    const intl = useIntl();
    const label = intl.formatMessage(messages.label);

    return (
        <Select
            value={value || ALL}
            onValueChange={(next) => onChange(next === ALL ? '' : next)}
        >
            <SelectTrigger
                className="h-9 w-full rounded-lg shadow-none sm:w-[220px]"
                aria-label={label}
            >
                <SelectValue placeholder={intl.formatMessage(messages.all)} />
            </SelectTrigger>
            <SelectContent className="rounded-lg shadow-none">
                <SelectGroup>
                    <SelectItem value={ALL}>
                        {intl.formatMessage(messages.all)}
                    </SelectItem>
                    {ACTIVITY_KIND_VALUES.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                            {formatActivityAction(intl, kind)}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
