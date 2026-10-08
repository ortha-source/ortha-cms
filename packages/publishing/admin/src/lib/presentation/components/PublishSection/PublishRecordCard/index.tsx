import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight, ExternalLink } from 'lucide-react';
import {
    Badge,
    Checkbox,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import {
    BULK_VERDICT,
    contentEntryPath,
    entryStatusView,
    ENTRY_STATUS_VIEW_VARIANT,
    type BulkPublishVerdict
} from '@orthacms/content-admin';
import {
    checkedOf,
    isPicked,
    optionAxes,
    PICK_STATE,
    recordState,
    type Picks
} from '../../../../domain/publishPicks';
import {
    isPublishable,
    type PublishAxis,
    type PublishRecord
} from '../../../../domain/types';
import type { PublishOutcome } from '../../../../application/usePublishRun';
import type { PublishAnnotation } from '../../../slots/publishingSlots';
import { PublishEntryRow } from './PublishEntryRow';

const messages = defineMessages({
    toggle: {
        id: 'publishing.record.toggle',
        defaultMessage: 'Publish everything picked for {record}'
    },
    open: {
        id: 'publishing.record.open',
        defaultMessage: 'Open {record} in a new tab'
    },
    expand: {
        id: 'publishing.record.expand',
        defaultMessage: 'Show the entries of {record}'
    },
    collapse: {
        id: 'publishing.record.collapse',
        defaultMessage: 'Hide the entries of {record}'
    },
    linked: { id: 'publishing.record.linked', defaultMessage: 'Linked draft' },
    via: {
        id: 'publishing.record.via',
        defaultMessage: '{field} on “{from}”'
    },
    picked: {
        id: 'publishing.record.picked',
        defaultMessage: '{picked} of {options} picked'
    },
    nothingToPublish: {
        id: 'publishing.record.nothingToPublish',
        defaultMessage: 'Nothing to publish'
    },
    issues: {
        id: 'publishing.record.issues',
        defaultMessage:
            '{count, plural, one {# entry needs fixes} other {# entries need fixes}}'
    },
    missing: {
        id: 'publishing.record.missing',
        defaultMessage: 'Not translated: {locales}'
    }
});

/**
 * One record of the Publish Manager as a **collapsible card** — the shape that
 * keeps working at two dozen locales, where a records × locales table turns
 * into a horizontal scroll nobody reads.
 *
 * The header is the record at a glance: a tri-state checkbox over everything
 * of it that can publish, its name (linking to its editor in a new tab), where
 * it came from when a link brought it in, a strip of its locales tinted by
 * publish state, how much is picked and how much needs fixing. The body lists
 * its entries one per row ({@link PublishEntryRow}), each with its own field
 * checklist, and names the locales it has no translation in, in one line.
 */
export function PublishRecordCard({
    record,
    name,
    workspaceId,
    axes,
    open,
    picks,
    annotations,
    verdicts,
    outcomes,
    checking,
    disabled,
    localizedFields,
    onOpenChange,
    onToggleRecord,
    onToggleCell
}: {
    record: PublishRecord;
    name: string;
    workspaceId: string;
    /** The section's axes, in display order. */
    axes: readonly PublishAxis[];
    open: boolean;
    picks: Picks;
    annotations: ReadonlyMap<string, PublishAnnotation[]>;
    verdicts: ReadonlyMap<string, BulkPublishVerdict>;
    outcomes: ReadonlyMap<string, PublishOutcome> | undefined;
    checking: boolean;
    disabled: boolean;
    localizedFields: ReadonlySet<string>;
    onOpenChange: (open: boolean) => void;
    onToggleRecord: (on: boolean) => void;
    onToggleCell: (axis: string, on: boolean) => void;
}) {
    const intl = useIntl();
    const state = recordState(picks, record);
    const options = optionAxes(record);
    const pickedCount = options.filter((axis) =>
        isPicked(picks, record.key, axis)
    ).length;
    const present = axes.filter((axis) => record.cells.has(axis.key));
    const missing = record.localized
        ? axes.filter((axis) => !record.cells.has(axis.key))
        : [];
    const blocked = [...record.cells.values()].filter(
        (cell) =>
            isPublishable(cell) &&
            verdicts.get(cell.id)?.verdict === BULK_VERDICT.Blocked
    ).length;

    return (
        <Collapsible
            open={open}
            onOpenChange={onOpenChange}
            className="rounded-lg border bg-background"
        >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                <Checkbox
                    checked={checkedOf(state)}
                    disabled={state === PICK_STATE.Unavailable || disabled}
                    onCheckedChange={() =>
                        onToggleRecord(state !== PICK_STATE.All)
                    }
                    aria-label={intl.formatMessage(messages.toggle, {
                        record: name
                    })}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate font-medium" title={name}>
                            {name}
                        </span>
                        <a
                            href={contentEntryPath(
                                workspaceId,
                                record.type,
                                record.anchorId
                            )}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={intl.formatMessage(messages.open, {
                                record: name
                            })}
                            className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                    </span>
                    {!record.selected && (
                        <span className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.linked)}
                            {record.via.length
                                ? ` · ${record.via
                                      .map((via) =>
                                          intl.formatMessage(messages.via, {
                                              field: via.fieldLabel,
                                              from: via.fromTitle
                                          })
                                      )
                                      .join(', ')}`
                                : null}
                        </span>
                    )}
                </span>
                {/* The record's locales at a glance — decoration: every one of
                    them is a row with its state in words when the card is open. */}
                {record.localized ? (
                    <span className="flex flex-wrap gap-1" aria-hidden>
                        {present.map((axis) => (
                            <Badge
                                key={axis.key}
                                variant={
                                    ENTRY_STATUS_VIEW_VARIANT[
                                        entryStatusView(
                                            record.cells.get(axis.key)
                                        )
                                    ]
                                }
                                className="px-1.5 py-0 font-mono text-[11px] uppercase"
                            >
                                {axis.code ?? axis.key}
                            </Badge>
                        ))}
                    </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                    {options.length
                        ? intl.formatMessage(messages.picked, {
                              picked: pickedCount,
                              options: options.length
                          })
                        : intl.formatMessage(messages.nothingToPublish)}
                </span>
                {blocked > 0 ? (
                    <span className="text-xs text-destructive">
                        {intl.formatMessage(messages.issues, {
                            count: blocked
                        })}
                    </span>
                ) : null}
                <CollapsibleTrigger
                    className="group/card rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={intl.formatMessage(
                        open ? messages.collapse : messages.expand,
                        { record: name }
                    )}
                >
                    <ChevronRight
                        className="size-4 transition-transform group-data-[state=open]/card:rotate-90"
                        aria-hidden
                    />
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
                <ul className="divide-y border-t px-3">
                    {present.map((axis) => {
                        const cell = record.cells.get(axis.key);
                        if (!cell) return null;
                        return (
                            <PublishEntryRow
                                key={axis.key}
                                cell={cell}
                                recordName={name}
                                axis={axis}
                                picked={isPicked(picks, record.key, axis.key)}
                                annotations={annotations.get(cell.id) ?? []}
                                verdict={verdicts.get(cell.id)}
                                outcome={outcomes?.get(cell.id)}
                                checking={checking}
                                disabled={disabled}
                                localizedFields={localizedFields}
                                onToggle={(on) => onToggleCell(axis.key, on)}
                            />
                        );
                    })}
                </ul>
                {missing.length > 0 ? (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                        {intl.formatMessage(messages.missing, {
                            locales: missing
                                .map((axis) => axis.label)
                                .join(', ')
                        })}
                    </p>
                ) : null}
            </CollapsibleContent>
        </Collapsible>
    );
}
