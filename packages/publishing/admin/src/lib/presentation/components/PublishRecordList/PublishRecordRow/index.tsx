import { defineMessages, useIntl } from 'react-intl';
import { ExternalLink } from 'lucide-react';
import { Checkbox } from '@orthacms/design-system';
import { contentEntryPath } from '@orthacms/content-admin';
import {
    checkedOf,
    isPicked,
    PICK_STATE,
    recordState,
    type Picks
} from '../../../../domain/publishPicks';
import {
    BASE_AXIS,
    isPublishable,
    type PublishAxis,
    type PublishRecord
} from '../../../../domain/types';
import type { PublishOutcome } from '../../../../application/usePublishRun';
import { EntryPill, type PillState } from './EntryPill';

const messages = defineMessages({
    toggle: {
        id: 'publishing.record.toggle',
        defaultMessage: 'Publish everything picked for {record}'
    },
    open: {
        id: 'publishing.record.open',
        defaultMessage: 'Open {record} in a new tab'
    },
    via: {
        id: 'publishing.record.via',
        defaultMessage: '{type} · via {field} on “{from}”'
    },
    nothing: {
        id: 'publishing.record.nothing',
        defaultMessage: 'Nothing to publish'
    }
});

/**
 * One record as **one line**: a tri-state checkbox over everything of it that
 * can publish, its name (and, for a linked draft, where it came from), and a
 * pill per locale that is worth a decision — pending ones, blocked ones, and
 * ones this page just published. Live locales and missing translations are not
 * shown: neither is something to decide here.
 */
export function PublishRecordRow({
    record,
    name,
    typeLabel,
    workspaceId,
    axes,
    picks,
    held,
    outcomes,
    disabled,
    onToggleRecord,
    onToggleCell
}: {
    record: PublishRecord;
    name: string;
    /** The record's type label, shown on a linked draft. */
    typeLabel: string;
    workspaceId: string;
    /** Every known axis, in display order. */
    axes: ReadonlyMap<string, PublishAxis>;
    picks: Picks;
    /** Whether a publish rule holds an entry, by id. */
    held: (entryId: string) => boolean;
    outcomes: ReadonlyMap<string, PublishOutcome> | undefined;
    disabled: boolean;
    onToggleRecord: (on: boolean) => void;
    onToggleCell: (axis: string, on: boolean) => void;
}) {
    const intl = useIntl();
    const state = recordState(picks, record);
    const order = [...axes.keys()];
    const pills = [...record.cells.values()]
        .map((cell) => {
            const pill: PillState | null =
                outcomes?.get(cell.id)?.kind === 'published'
                    ? 'published'
                    : cell.blocked
                      ? 'blocked'
                      : // A type without locales has one entry, and the
                        // record's own checkbox already picks it.
                        isPublishable(cell) && cell.axis !== BASE_AXIS
                        ? 'option'
                        : null;
            return pill ? { cell, pill } : null;
        })
        .filter((item) => item !== null)
        .sort(
            (a, b) => order.indexOf(a.cell.axis) - order.indexOf(b.cell.axis)
        );

    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <Checkbox
                checked={checkedOf(state)}
                disabled={state === PICK_STATE.Unavailable || disabled}
                onCheckedChange={() => onToggleRecord(state !== PICK_STATE.All)}
                aria-label={intl.formatMessage(messages.toggle, {
                    record: name
                })}
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1">
                    <span className="truncate text-sm font-medium" title={name}>
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
                {!record.selected && record.via.length > 0 ? (
                    <span className="truncate text-xs text-muted-foreground">
                        {intl.formatMessage(messages.via, {
                            type: typeLabel,
                            field: record.via[0].fieldLabel,
                            from: record.via[0].fromTitle
                        })}
                    </span>
                ) : null}
            </span>
            {pills.length === 0 && state === PICK_STATE.Unavailable ? (
                <span className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.nothing)}
                </span>
            ) : pills.length === 0 ? null : (
                <span className="flex flex-wrap gap-1.5">
                    {pills.map(({ cell, pill }) => (
                        <EntryPill
                            key={cell.axis}
                            cell={cell}
                            axis={
                                axes.get(cell.axis) ?? {
                                    key: cell.axis,
                                    label: cell.axis,
                                    code: cell.axis
                                }
                            }
                            recordName={name}
                            state={pill}
                            picked={isPicked(picks, record.key, cell.axis)}
                            held={held(cell.id)}
                            disabled={disabled}
                            onToggle={(on) => onToggleCell(cell.axis, on)}
                        />
                    ))}
                </span>
            )}
        </li>
    );
}
