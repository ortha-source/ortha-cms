import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import { humanizeKey, type ActivityDiffRow } from '../../../activityDiff';
import { formatRole } from '../../../activitySentence';

/** Intl descriptors for {@link EventDiffTable}, co-located. */
const messages = defineMessages({
    caption: {
        id: 'activity.event.diff.caption',
        defaultMessage: 'What changed'
    },
    field: { id: 'activity.event.diff.field', defaultMessage: 'Field' },
    before: { id: 'activity.event.diff.before', defaultMessage: 'Before' },
    after: { id: 'activity.event.diff.after', defaultMessage: 'After' },
    none: { id: 'activity.event.diff.none', defaultMessage: '—' },
    on: { id: 'activity.event.diff.on', defaultMessage: 'On' },
    off: { id: 'activity.event.diff.off', defaultMessage: 'Off' },
    role: { id: 'activity.event.diff.role', defaultMessage: 'Role' },
    name: { id: 'activity.event.diff.name', defaultMessage: 'Name' },
    enabled: { id: 'activity.event.diff.enabled', defaultMessage: 'Enabled' },
    tags: { id: 'activity.event.diff.tags', defaultMessage: 'Tags' },
    visibility: {
        id: 'activity.event.diff.visibility',
        defaultMessage: 'Visibility'
    },
    mode: { id: 'activity.event.diff.mode', defaultMessage: 'Mode' },
    value: { id: 'activity.event.diff.value', defaultMessage: 'Value' }
});

/** Field labels the panel knows; anything else is humanized from its key. */
const FIELD_LABELS: Record<string, (typeof messages)[keyof typeof messages]> = {
    role: messages.role,
    name: messages.name,
    enabled: messages.enabled,
    tags: messages.tags,
    visibility: messages.visibility,
    mode: messages.mode,
    value: messages.value
};

/** One recorded value, as text. `—` for nothing; never `undefined`/`null`. */
function formatValue(intl: IntlShape, key: string, value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return intl.formatMessage(messages.none);
    }
    if (typeof value === 'boolean') {
        return intl.formatMessage(value ? messages.on : messages.off);
    }
    if (Array.isArray(value)) {
        return value.length > 0
            ? value.map((item) => String(item)).join(', ')
            : intl.formatMessage(messages.none);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    if (key === 'role' && typeof value === 'string') return formatRole(value);
    return String(value);
}

/**
 * The event panel's before/after table — one row per recorded transition.
 *
 * A real design-system `Table`, named by a caption, with the before value
 * struck through and the after value in the success tone. The strike and the
 * colour are never the only signal: the column headings say which is which.
 */
export function EventDiffTable({ rows }: { rows: ActivityDiffRow[] }) {
    const intl = useIntl();
    return (
        <div className="overflow-hidden rounded-lg border">
            <Table>
                <caption className="sr-only">
                    {intl.formatMessage(messages.caption)}
                </caption>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.field)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.before)}
                        </TableHead>
                        <TableHead scope="col">
                            {intl.formatMessage(messages.after)}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => {
                        const label = FIELD_LABELS[row.key];
                        return (
                            <TableRow key={row.key}>
                                <TableCell className="align-top">
                                    {label
                                        ? intl.formatMessage(label)
                                        : humanizeKey(row.key)}
                                </TableCell>
                                <TableCell className="align-top break-words text-destructive line-through decoration-1">
                                    {formatValue(intl, row.key, row.before)}
                                </TableCell>
                                <TableCell className="align-top break-words text-success-soft-foreground">
                                    {formatValue(intl, row.key, row.after)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
