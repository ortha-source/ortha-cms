import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@orthacms/design-system';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { BellOff, BellRing } from 'lucide-react';
import type { AlarmFinding } from '../../../../types/alarm';
import { SeverityBadge } from '../../SeverityBadge';

const messages = defineMessages({
    context: {
        id: 'alarms.finding.context',
        defaultMessage: '{ruleName} · {contentType}'
    },
    open: { id: 'alarms.finding.open', defaultMessage: 'Open record' },
    mute: { id: 'alarms.finding.mute', defaultMessage: 'Mute' },
    unmute: { id: 'alarms.finding.unmute', defaultMessage: 'Unmute' },
    muteLabel: {
        id: 'alarms.finding.muteLabel',
        defaultMessage: 'Mute “{title}” on this record'
    },
    unmuteLabel: {
        id: 'alarms.finding.unmuteLabel',
        defaultMessage: 'Unmute “{title}” on this record'
    },
    mutedBecause: {
        id: 'alarms.finding.mutedBecause',
        defaultMessage: 'Muted: {reason}'
    },
    mutedNoReason: {
        id: 'alarms.finding.mutedNoReason',
        defaultMessage: 'Muted, with no reason given'
    },
    since: {
        id: 'alarms.finding.since',
        defaultMessage: 'Open since {date}'
    }
});

/** Props for {@link FindingRow}. */
export type FindingRowProps = {
    /** The finding this row is about. */
    finding: AlarmFinding;
    /** Whether the caller may mute (i.e. holds `alarms:manage`). */
    canManage: boolean;
    /** Mute this finding. */
    onMute: (finding: AlarmFinding) => void;
    /** Lift the mute on this finding. */
    onUnmute: (finding: AlarmFinding) => void;
};

/**
 * One finding: what is wrong, on which record, and the two things you can do
 * about it.
 *
 * The title is the **rule's finding title**, not its name — the rule is called
 * something in the language of editorial policy ("Relations point at published
 * records") and the row has to speak to whoever is looking at one article
 * ("Author is not published").
 */
export function FindingRow({
    finding,
    canManage,
    onMute,
    onUnmute
}: FindingRowProps) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const isMuted = finding.state === 'muted';
    const entryPath = `/workspaces/${workspace.id}/content/${finding.contentType}/${finding.entryId}`;

    return (
        <li className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
            <SeverityBadge severity={finding.severity} className="mt-0.5" />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                    className={
                        isMuted
                            ? 'truncate font-medium text-muted-foreground'
                            : 'truncate font-medium'
                    }
                >
                    {finding.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {intl.formatMessage(messages.context, {
                        ruleName: finding.ruleName,
                        contentType: finding.contentType
                    })}
                </span>
                {isMuted ? (
                    <span className="truncate text-xs text-muted-foreground">
                        {finding.mutedReason
                            ? intl.formatMessage(messages.mutedBecause, {
                                  reason: finding.mutedReason
                              })
                            : intl.formatMessage(messages.mutedNoReason)}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.since, {
                            date: intl.formatDate(finding.firstSeenAt, {
                                dateStyle: 'medium'
                            })
                        })}
                    </span>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline" size="sm">
                    <Link to={entryPath}>
                        {intl.formatMessage(messages.open)}
                    </Link>
                </Button>
                {canManage ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            isMuted ? onUnmute(finding) : onMute(finding)
                        }
                        // The visible label is one word; the accessible name
                        // says which finding it acts on, because a list of
                        // identically-labelled buttons is unusable by ear.
                        aria-label={intl.formatMessage(
                            isMuted ? messages.unmuteLabel : messages.muteLabel,
                            { title: finding.title }
                        )}
                    >
                        {isMuted ? (
                            <BellRing aria-hidden="true" />
                        ) : (
                            <BellOff aria-hidden="true" />
                        )}
                        {intl.formatMessage(
                            isMuted ? messages.unmute : messages.mute
                        )}
                    </Button>
                ) : null}
            </div>
        </li>
    );
}
