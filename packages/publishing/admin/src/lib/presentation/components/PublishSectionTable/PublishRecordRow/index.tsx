import { defineMessages, useIntl } from 'react-intl';
import { ExternalLink } from 'lucide-react';
import { Checkbox, TableCell, TableRow } from '@orthacms/design-system';
import {
    contentEntryPath,
    type BulkPublishVerdict
} from '@orthacms/content-admin';
import {
    isPicked,
    PICK_STATE,
    recordState,
    type Picks
} from '../../../../domain/publishPicks';
import type { PublishAxis, PublishRecord } from '../../../../domain/types';
import type { PublishOutcome } from '../../../../application/usePublishRun';
import type { PublishAnnotation } from '../../../slots/publishingSlots';
import { checkedOf } from '../AxisHeader';
import { PublishCellView } from './PublishCellView';

const messages = defineMessages({
    toggle: {
        id: 'publishing.record.toggle',
        defaultMessage: 'Publish everything picked for {record}'
    },
    open: {
        id: 'publishing.record.open',
        defaultMessage: 'Open {record} in a new tab'
    },
    linked: {
        id: 'publishing.record.linked',
        defaultMessage: 'Linked draft'
    },
    via: {
        id: 'publishing.record.via',
        defaultMessage: '{field} on “{from}”'
    }
});

/**
 * One record across its section's axis columns: its name (linking to its
 * editor in a new tab), where it came from when it was reached by a link, a
 * tri-state checkbox over every entry of it that can publish, then one
 * {@link PublishCellView} per axis.
 *
 * The name cell is sticky, so with two dozen locales the reader scrolling
 * right still knows whose row they are in.
 */
export function PublishRecordRow({
    record,
    name,
    workspaceId,
    axes,
    picks,
    annotations,
    verdicts,
    outcomes,
    disabled,
    onToggleRecord,
    onToggleCell
}: {
    record: PublishRecord;
    name: string;
    workspaceId: string;
    axes: readonly PublishAxis[];
    picks: Picks;
    annotations: ReadonlyMap<string, PublishAnnotation[]>;
    verdicts: ReadonlyMap<string, BulkPublishVerdict>;
    outcomes: ReadonlyMap<string, PublishOutcome> | undefined;
    disabled: boolean;
    onToggleRecord: (on: boolean) => void;
    onToggleCell: (axis: string, on: boolean) => void;
}) {
    const intl = useIntl();
    const state = recordState(picks, record);
    return (
        <TableRow>
            <TableCell className="sticky left-0 z-10 bg-background align-top">
                <span className="flex min-w-0 items-start gap-2">
                    <Checkbox
                        className="mt-0.5"
                        checked={checkedOf(state)}
                        disabled={state === PICK_STATE.Unavailable || disabled}
                        onCheckedChange={() =>
                            onToggleRecord(state !== PICK_STATE.All)
                        }
                        aria-label={intl.formatMessage(messages.toggle, {
                            record: name
                        })}
                    />
                    <span className="flex min-w-0 flex-col">
                        <span className="flex min-w-0 items-center gap-1">
                            <span className="max-w-64 truncate" title={name}>
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
                                <ExternalLink
                                    className="size-3.5"
                                    aria-hidden
                                />
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
                </span>
            </TableCell>
            {axes.map((axis) => {
                const cell = record.cells.get(axis.key);
                return (
                    <PublishCellView
                        key={axis.key}
                        cell={cell}
                        recordName={name}
                        axisLabel={axis.label}
                        picked={isPicked(picks, record.key, axis.key)}
                        annotations={
                            cell ? (annotations.get(cell.id) ?? []) : []
                        }
                        verdict={cell ? verdicts.get(cell.id) : undefined}
                        outcome={cell ? outcomes?.get(cell.id) : undefined}
                        disabled={disabled}
                        onToggle={(on) => onToggleCell(axis.key, on)}
                    />
                );
            })}
        </TableRow>
    );
}
