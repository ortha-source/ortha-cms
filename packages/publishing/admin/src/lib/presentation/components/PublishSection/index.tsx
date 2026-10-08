import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Checkbox } from '@orthacms/design-system';
import {
    useContentSchema,
    type BulkPublishVerdict
} from '@orthacms/content-admin';
import {
    checkedOf,
    PICK_STATE,
    recordsState,
    setAxis,
    setCell,
    setRecord,
    setRecords,
    type Picks
} from '../../../domain/publishPicks';
import type { PublishSection as Section } from '../../../domain/publishRecords';
import {
    BASE_AXIS,
    recordTitle,
    type PublishAxis
} from '../../../domain/types';
import type { PublishOutcome } from '../../../application/usePublishRun';
import type { PublishAnnotation } from '../../slots/publishingSlots';
import { LocaleBar } from './LocaleBar';
import { PublishRecordCard } from './PublishRecordCard';

const messages = defineMessages({
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
 * The section's axes, in display order. A localized section lists **every**
 * axis an expansion defines (every configured locale) whether or not a record
 * has an entry there — what a record lacks is said on its card — then any axis
 * found on the records but defined by nobody (no i18n plugin registered), by
 * slug. A section with no locales has the one base axis.
 */
function sectionAxes(
    section: Section,
    defined: ReadonlyMap<string, PublishAxis>,
    entryLabel: string
): PublishAxis[] {
    const localized = section.records.some((record) => record.localized);
    if (!localized) return [{ key: BASE_AXIS, label: entryLabel }];
    const found = new Set<string>();
    for (const record of section.records) {
        for (const axis of record.cells.keys()) found.add(axis);
    }
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
 * One content type's records in the Publish Manager: a heading with a
 * tri-state toggle for the whole type, the {@link LocaleBar} (one chip per
 * locale, for every record at once) on a localized type, and one collapsible
 * {@link PublishRecordCard} per record. Every toggle goes through `onPicks`,
 * so the page owns the picks and the pick algebra is the only thing deciding
 * what a click means.
 *
 * It reads the type's schema for one thing: which fields are translated per
 * locale, so a record's field checklist can mark them.
 */
export function PublishSection({
    section,
    typeLabel,
    workspaceId,
    definedAxes,
    picks,
    annotations,
    verdicts,
    outcomes,
    checking,
    disabled,
    isOpen,
    onOpenChange,
    onPicks
}: {
    section: Section;
    typeLabel: string;
    workspaceId: string;
    definedAxes: ReadonlyMap<string, PublishAxis>;
    picks: Picks;
    annotations: ReadonlyMap<string, PublishAnnotation[]>;
    verdicts: ReadonlyMap<string, BulkPublishVerdict>;
    outcomes: ReadonlyMap<string, PublishOutcome> | undefined;
    checking: boolean;
    disabled: boolean;
    isOpen: (recordKey: string) => boolean;
    onOpenChange: (recordKey: string, open: boolean) => void;
    onPicks: (update: (current: Picks) => Picks) => void;
}) {
    const intl = useIntl();
    const headingId = useId();
    const axes = sectionAxes(
        section,
        definedAxes,
        intl.formatMessage(messages.entry)
    );
    const localized = section.records.some((record) => record.localized);
    const schema = useContentSchema(section.type, localized);
    const localizedFields = new Set(
        (schema.data?.fields ?? [])
            .filter((field) => field.localized)
            .map((field) => field.name)
    );
    const state = recordsState(picks, section.records);

    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-3">
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
            {localized ? (
                <LocaleBar
                    axes={axes}
                    records={section.records}
                    typeLabel={typeLabel}
                    picks={picks}
                    disabled={disabled}
                    onToggle={(axis, on) =>
                        onPicks((current) =>
                            setAxis(current, section.records, axis, on)
                        )
                    }
                />
            ) : null}
            <div className="flex flex-col gap-2">
                {section.records.map((record) => (
                    <PublishRecordCard
                        key={record.key}
                        record={record}
                        name={recordTitle(record)}
                        workspaceId={workspaceId}
                        axes={axes}
                        open={isOpen(record.key)}
                        picks={picks}
                        annotations={annotations}
                        verdicts={verdicts}
                        outcomes={outcomes}
                        checking={checking}
                        disabled={disabled}
                        localizedFields={localizedFields}
                        onOpenChange={(open) => onOpenChange(record.key, open)}
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
            </div>
        </section>
    );
}
