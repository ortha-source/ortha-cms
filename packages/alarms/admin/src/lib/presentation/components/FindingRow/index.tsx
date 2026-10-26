import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@orthacms/design-system';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { ArrowRight, Table2 } from 'lucide-react';
import type { AlarmFinding } from '../../../types/alarm';
import { formatAge } from '../../relativeTime';

const messages = defineMessages({
    open: { id: 'alarms.finding.open', defaultMessage: 'Open' },
    openLabel: {
        id: 'alarms.finding.openLabel',
        defaultMessage: 'Open {title}'
    },
    flagged: {
        id: 'alarms.finding.flagged',
        defaultMessage: 'flagged {when}'
    },
    flaggedOn: {
        id: 'alarms.finding.flaggedOn',
        defaultMessage: 'Flagged on {date}'
    }
});

/** Props for {@link FindingRow}. */
export type FindingRowProps = {
    /** The finding this row is about. */
    finding: AlarmFinding;
    /** The collection's display label ("Articles"). */
    typeLabel: string;
};

/**
 * One flagged record, inside its alarm's group: which record, by its title,
 * and how long it has been flagged.
 *
 * The group header already carries the alarm, the sentence editors read and
 * the severity, so the row is one dense line of what differs between records.
 * The age is relative ("flagged 2 weeks ago") because that is the question a
 * list of problems raises — which of these have been rotting — and the exact
 * date is on hover.
 *
 * **The title comes from the server**, by content's own `entryTitle` rule; a
 * record with no title-eligible value is named by its id rather than given an
 * invented label.
 *
 * There is no per-row action beyond opening the record. Muting one record at a
 * time is gone (`alarms:I-20`): an alarm is either right about a record or
 * wrong about it, and the answer to a wrong one is to narrow or switch off the
 * alarm, where the next person can see the decision.
 */
export function FindingRow({ finding, typeLabel }: FindingRowProps) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const entryPath = `/workspaces/${workspace.id}/content/${finding.contentType}/${finding.entryId}`;
    const title = finding.entryTitle ?? finding.entryId;

    return (
        <li className="flex items-center gap-3 py-2 pl-11 pr-4">
            <Table2
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <Link
                    to={entryPath}
                    className={
                        finding.entryTitle
                            ? 'min-w-0 truncate text-sm font-medium underline underline-offset-2 hover:no-underline'
                            : 'min-w-0 truncate text-sm font-medium tabular-nums underline underline-offset-2 hover:no-underline'
                    }
                >
                    {title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                    {typeLabel}
                </span>
            </span>

            <span
                className="shrink-0 text-xs text-muted-foreground"
                title={intl.formatMessage(messages.flaggedOn, {
                    date: intl.formatDate(finding.firstSeenAt, {
                        dateStyle: 'medium'
                    })
                })}
            >
                {intl.formatMessage(messages.flagged, {
                    when: formatAge(intl, finding.firstSeenAt)
                })}
            </span>

            <Button asChild variant="ghost" size="sm" className="h-7 shrink-0">
                <Link
                    to={entryPath}
                    aria-label={intl.formatMessage(messages.openLabel, {
                        title
                    })}
                >
                    <ArrowRight aria-hidden="true" />
                    {intl.formatMessage(messages.open)}
                </Link>
            </Button>
        </li>
    );
}
