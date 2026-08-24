import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertDescription, AlertTitle } from '@orthacms/design-system';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { AlarmFinding } from '../../../types/alarm';
import { FindingRow } from './FindingRow';

const messages = defineMessages({
    errorTitle: {
        id: 'alarms.findings.errorTitle',
        defaultMessage: "Couldn't load findings"
    },
    errorBody: {
        id: 'alarms.findings.errorBody',
        defaultMessage:
            'The request failed. Nothing here reflects the current state of your content until it succeeds.'
    },
    emptyTitle: {
        id: 'alarms.findings.emptyTitle',
        defaultMessage: 'Nothing is flagged'
    },
    emptyBody: {
        id: 'alarms.findings.emptyBody',
        defaultMessage:
            'No entry currently matches any of this workspace’s rules.'
    },
    listLabel: {
        id: 'alarms.findings.listLabel',
        defaultMessage: 'Findings'
    }
});

/** Props for {@link FindingList}. */
export type FindingListProps = {
    /** The findings to render. */
    findings: readonly AlarmFinding[];
    /** The request failed — rendered instead of the empty state. */
    isError: boolean;
    /** Whether the caller may mute (i.e. holds `alarms:manage`). */
    canManage: boolean;
    /** Mute this finding. */
    onMute: (finding: AlarmFinding) => void;
    /** Lift the mute on this finding. */
    onUnmute: (finding: AlarmFinding) => void;
};

/**
 * A flat list of findings.
 *
 * **A failed load is not an empty list.** They look identical if you let
 * `isError` fall through, and the wrong one of the two tells an editor their
 * content is clean when nobody actually checked.
 */
export function FindingList({
    findings,
    isError,
    canManage,
    onMute,
    onUnmute
}: FindingListProps) {
    const intl = useIntl();

    if (isError) {
        return (
            <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>
                    {intl.formatMessage(messages.errorTitle)}
                </AlertTitle>
                <AlertDescription>
                    {intl.formatMessage(messages.errorBody)}
                </AlertDescription>
            </Alert>
        );
    }

    if (findings.length === 0) {
        return (
            <Alert>
                <CircleCheck aria-hidden="true" />
                <AlertTitle>
                    {intl.formatMessage(messages.emptyTitle)}
                </AlertTitle>
                <AlertDescription>
                    {intl.formatMessage(messages.emptyBody)}
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <ul
            className="flex flex-col divide-y divide-border rounded-md border"
            aria-label={intl.formatMessage(messages.listLabel)}
        >
            {findings.map((finding) => (
                <FindingRow
                    key={`${finding.ruleId}:${finding.entryId}`}
                    finding={finding}
                    canManage={canManage}
                    onMute={onMute}
                    onUnmute={onUnmute}
                />
            ))}
        </ul>
    );
}
