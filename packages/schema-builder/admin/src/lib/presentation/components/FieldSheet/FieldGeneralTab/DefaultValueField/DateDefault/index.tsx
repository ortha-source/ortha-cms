import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { InputField } from '@orthacms/design-system';
import { DEFAULT_NOW, DEFAULT_TODAY } from '@orthacms/content-domain';
import { OneOfDefault } from '../OneOfDefault';

const messages = defineMessages({
    today: { id: 'schemaBuilder.default.today', defaultMessage: 'Today' },
    now: { id: 'schemaBuilder.default.now', defaultMessage: 'Now' },
    fixedDate: {
        id: 'schemaBuilder.default.fixedDate',
        defaultMessage: 'A fixed date'
    },
    fixedDatetime: {
        id: 'schemaBuilder.default.fixedDatetime',
        defaultMessage: 'A fixed date and time'
    },
    fixedValue: {
        id: 'schemaBuilder.default.fixedValue',
        defaultMessage: 'Date'
    }
});

const FIXED = 'fixed';

const pad = (n: number) => String(n).padStart(2, '0');

/** `date` as the entry form writes it: local, no zone. */
function fixedFrom(date: Date, withTime: boolean): string {
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return withTime
        ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
        : day;
}

type Props = {
    id: string;
    label: ReactNode;
    noneLabel: ReactNode;
    describedBy: string;
    withTime: boolean;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
};

/**
 * A date's default: none, the day (or minute) the form is opened, or a fixed
 * one. The fixed value is written in the entry form's own format —
 * `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` for a datetime.
 */
export function DateDefault({
    id,
    label,
    noneLabel,
    describedBy,
    withTime,
    value,
    onChange
}: Props) {
    const intl = useIntl();
    const relative = withTime ? DEFAULT_NOW : DEFAULT_TODAY;
    const mode =
        value === undefined ? undefined : value === relative ? relative : FIXED;
    return (
        <div className="flex flex-col gap-2">
            <OneOfDefault
                id={id}
                label={label}
                noneLabel={noneLabel}
                describedBy={describedBy}
                value={mode}
                choices={[
                    {
                        value: relative,
                        label: intl.formatMessage(
                            withTime ? messages.now : messages.today
                        )
                    },
                    {
                        value: FIXED,
                        label: intl.formatMessage(
                            withTime
                                ? messages.fixedDatetime
                                : messages.fixedDate
                        )
                    }
                ]}
                onChange={(next) =>
                    // A fixed date starts at the current one, so the choice
                    // lands in the draft at once; clearing it is "no default".
                    onChange(
                        next === FIXED ? fixedFrom(new Date(), withTime) : next
                    )
                }
            />
            {mode === FIXED && (
                <InputField
                    id={`${id}-fixed`}
                    type={withTime ? 'datetime-local' : 'date'}
                    label={intl.formatMessage(messages.fixedValue)}
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
        </div>
    );
}
