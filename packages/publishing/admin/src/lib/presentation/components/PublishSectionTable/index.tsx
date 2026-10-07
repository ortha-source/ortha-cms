import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Checkbox,
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import type { BulkPublishVerdict } from '@orthacms/content-admin';
import {
    axisState,
    recordsState,
    setAxis,
    setCell,
    setRecord,
    setRecords,
    PICK_STATE,
    type Picks
} from '../../../domain/publishPicks';
import type { PublishSection } from '../../../domain/publishRecords';
import {
    BASE_AXIS,
    recordTitle,
    type PublishAxis
} from '../../../domain/types';
import type { PublishOutcome } from '../../../application/usePublishRun';
import type { PublishAnnotation } from '../../slots/publishingSlots';
import { AxisHeader, checkedOf } from './AxisHeader';
import { PublishRecordRow } from './PublishRecordRow';

const messages = defineMessages({
    record: { id: 'publishing.section.record', defaultMessage: 'Record' },
    entry: { id: 'publishing.section.entry', defaultMessage: 'Entry' },
    count: {
        id: 'publishing.section.count',
        defaultMessage: '{count, plural, one {# record} other {# records}}'
    },
    toggle: {
        id: 'publishing.section.toggle',
        defaultMessage: 'Publish everything picked in {type}'
    }
});

/**
 * The section's columns. A localized section shows **every** axis an
 * expansion defines (every configured locale), whether or not any record has
 * an entry there — a column of dashes is what "nobody translated this" looks
 * like, and hiding it would say the language does not exist. Axes found on the
 * records but defined by nobody (no i18n plugin registered) follow, by slug.
 * A section with no locales has the one base column.
 */
function sectionAxes(
    section: PublishSection,
    defined: ReadonlyMap<string, PublishAxis>,
    entryLabel: string
): PublishAxis[] {
    const found = new Set<string>();
    for (const record of section.records) {
        for (const axis of record.cells.keys()) found.add(axis);
    }
    const localized = section.records.some((record) => record.localized);
    if (!localized) return [{ key: BASE_AXIS, label: entryLabel }];
    const ordered = [...defined.values()].filter(
        (axis) => axis.key !== BASE_AXIS
    );
    const extra = [...found]
        .filter((key) => key !== BASE_AXIS && !defined.has(key))
        .sort()
        .map((key) => ({ key, label: key, code: key }));
    return [...ordered, ...extra];
}

/**
 * One content type's records in the Publish Manager — a table of records
 * against axes (locales, or the single entry column), with a tri-state toggle
 * for the whole section in its heading, one per column, one per record and
 * one per cell. Every toggle goes through `onPicks`, so the page owns the picks
 * and the pick algebra is the only thing deciding what a click means.
 */
export function PublishSectionTable({
    section,
    typeLabel,
    workspaceId,
    definedAxes,
    picks,
    annotations,
    verdicts,
    outcomes,
    disabled,
    onPicks
}: {
    section: PublishSection;
    typeLabel: string;
    workspaceId: string;
    definedAxes: ReadonlyMap<string, PublishAxis>;
    picks: Picks;
    annotations: ReadonlyMap<string, PublishAnnotation[]>;
    verdicts: ReadonlyMap<string, BulkPublishVerdict>;
    outcomes: ReadonlyMap<string, PublishOutcome> | undefined;
    disabled: boolean;
    onPicks: (update: (current: Picks) => Picks) => void;
}) {
    const intl = useIntl();
    const headingId = useId();
    const axes = sectionAxes(
        section,
        definedAxes,
        intl.formatMessage(messages.entry)
    );
    const state = recordsState(picks, section.records);

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Checkbox
                    checked={checkedOf(state)}
                    disabled={state === PICK_STATE.Unavailable || disabled}
                    onCheckedChange={() =>
                        onPicks((current) =>
                            setRecords(
                                current,
                                section.records,
                                state !== PICK_STATE.All
                            )
                        )
                    }
                    aria-label={intl.formatMessage(messages.toggle, {
                        type: typeLabel
                    })}
                />
                <h2 id={headingId} className="text-base font-semibold">
                    {typeLabel}
                </h2>
                <span className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.count, {
                        count: section.records.length
                    })}
                </span>
            </div>
            <div className="rounded-lg border">
                <Table aria-labelledby={headingId}>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="sticky left-0 z-10">
                                {intl.formatMessage(messages.record)}
                            </TableHead>
                            {axes.map((axis) => (
                                <AxisHeader
                                    key={axis.key}
                                    axis={axis}
                                    typeLabel={typeLabel}
                                    state={axisState(
                                        picks,
                                        section.records,
                                        axis.key
                                    )}
                                    disabled={disabled}
                                    onToggle={(on) =>
                                        onPicks((current) =>
                                            setAxis(
                                                current,
                                                section.records,
                                                axis.key,
                                                on
                                            )
                                        )
                                    }
                                />
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {section.records.map((record) => (
                            <PublishRecordRow
                                key={record.key}
                                record={record}
                                name={recordTitle(record)}
                                workspaceId={workspaceId}
                                axes={axes}
                                picks={picks}
                                annotations={annotations}
                                verdicts={verdicts}
                                outcomes={outcomes}
                                disabled={disabled}
                                onToggleRecord={(on) =>
                                    onPicks((current) =>
                                        setRecord(current, record, on)
                                    )
                                }
                                onToggleCell={(axis, on) =>
                                    onPicks((current) =>
                                        setCell(current, record, axis, on)
                                    )
                                }
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
