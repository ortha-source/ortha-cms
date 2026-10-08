import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { setCell, setRecord, type Picks } from '../../../domain/publishPicks';
import {
    recordTitle,
    type PublishAxis,
    type PublishRecord
} from '../../../domain/types';
import type { PublishOutcome } from '../../../application/usePublishRun';
import { PublishRecordRow } from './PublishRecordRow';

const messages = defineMessages({
    count: {
        id: 'publishing.list.count',
        defaultMessage: '{count, plural, one {# record} other {# records}}'
    }
});

/**
 * A titled list of records, one line each — the set's own records under the
 * type's name, or the linked drafts under "Linked drafts". Every toggle goes
 * through `onPicks`, so the page owns the picks.
 */
export function PublishRecordList({
    title,
    records,
    typeLabel,
    workspaceId,
    axes,
    picks,
    held,
    outcomes,
    disabled,
    onPicks
}: {
    title: string;
    records: readonly PublishRecord[];
    typeLabel: (type: string) => string;
    workspaceId: string;
    axes: ReadonlyMap<string, PublishAxis>;
    picks: Picks;
    held: (entryId: string) => boolean;
    outcomes: ReadonlyMap<string, PublishOutcome> | undefined;
    disabled: boolean;
    onPicks: (update: (current: Picks) => Picks) => void;
}) {
    const intl = useIntl();
    const headingId = useId();
    if (records.length === 0) return null;
    return (
        <section aria-labelledby={headingId}>
            <h2
                id={headingId}
                className="mb-1 flex items-baseline gap-2 text-sm font-semibold"
            >
                {title}
                <span className="font-normal text-muted-foreground">
                    {intl.formatMessage(messages.count, {
                        count: records.length
                    })}
                </span>
            </h2>
            <ul className="divide-y">
                {records.map((record) => (
                    <PublishRecordRow
                        key={record.key}
                        record={record}
                        name={recordTitle(record)}
                        typeLabel={typeLabel(record.type)}
                        workspaceId={workspaceId}
                        axes={axes}
                        picks={picks}
                        held={held}
                        outcomes={outcomes}
                        disabled={disabled}
                        onToggleRecord={(on) =>
                            onPicks((current) => setRecord(current, record, on))
                        }
                        onToggleCell={(axis, on) =>
                            onPicks((current) =>
                                setCell(current, record, axis, on)
                            )
                        }
                    />
                ))}
            </ul>
        </section>
    );
}
