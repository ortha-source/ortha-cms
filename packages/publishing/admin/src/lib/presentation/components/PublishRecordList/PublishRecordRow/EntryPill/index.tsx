import { defineMessages, useIntl } from 'react-intl';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { Checkbox, cn } from '@orthacms/design-system';
import {
    entryStatusView,
    ENTRY_STATUS_VIEW_LABEL
} from '@orthacms/content-admin';
import {
    BASE_AXIS,
    type PublishAxis,
    type PublishCell
} from '../../../../../domain/types';

const messages = defineMessages({
    pick: {
        id: 'publishing.cell.pick',
        defaultMessage: 'Publish {record}, {axis} ({status})'
    },
    blocked: {
        id: 'publishing.pill.blocked',
        defaultMessage: '{axis}: needs fixes before it can publish'
    },
    published: {
        id: 'publishing.pill.published',
        defaultMessage: '{axis}: published'
    },
    held: {
        id: 'publishing.pill.held',
        defaultMessage: 'awaiting approval'
    },
    needsFixes: {
        id: 'publishing.pill.needsFixes',
        defaultMessage: 'Needs fixes'
    },
    publishedText: {
        id: 'publishing.pill.publishedText',
        defaultMessage: 'Published'
    }
});

/** What a pill is showing. */
export type PillState = 'option' | 'blocked' | 'published';

/**
 * One locale of a record, as a small pill in the record's row — the code, and
 * a checkbox when it can be picked. Three shapes and no more:
 *
 * - **option** — a checkbox; amber with a shield when a publish rule holds it
 *   (it can be picked, the rule decides at publish);
 * - **blocked** — red, no checkbox: a field fails its gate, and what is
 *   missing is spelled out once, in "Needs attention", not here;
 * - **published** — green, after this page published it.
 *
 * The language name and state are in the accessible name; the pill shows the
 * code only.
 */
export function EntryPill({
    cell,
    axis,
    recordName,
    state,
    picked,
    held,
    disabled,
    onToggle
}: {
    cell: PublishCell;
    axis: PublishAxis;
    recordName: string;
    state: PillState;
    picked: boolean;
    held: boolean;
    disabled: boolean;
    onToggle: (on: boolean) => void;
}) {
    const intl = useIntl();
    // A type without locales has no code to show: the pill says its state.
    const base = axis.key === BASE_AXIS;
    const code = base
        ? intl.formatMessage(
              state === 'blocked' ? messages.needsFixes : messages.publishedText
          )
        : (axis.code ?? axis.label);
    const pill = cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs',
        !base && 'font-mono uppercase'
    );

    if (state === 'blocked') {
        return (
            <span
                className={cn(pill, 'border-destructive/50 text-destructive')}
                title={axis.label}
            >
                <XCircle className="size-3.5" aria-hidden />
                <span aria-hidden>{code}</span>
                <span className="sr-only">
                    {intl.formatMessage(messages.blocked, {
                        axis: axis.label
                    })}
                </span>
            </span>
        );
    }
    if (state === 'published') {
        return (
            <span
                className={cn(
                    pill,
                    'border-success/40 text-success-soft-foreground bg-success-soft'
                )}
                title={axis.label}
            >
                <CheckCircle2 className="size-3.5" aria-hidden />
                <span aria-hidden>{code}</span>
                <span className="sr-only">
                    {intl.formatMessage(messages.published, {
                        axis: axis.label
                    })}
                </span>
            </span>
        );
    }
    const status = intl.formatMessage(
        ENTRY_STATUS_VIEW_LABEL[entryStatusView(cell)]
    );
    return (
        <label
            title={`${axis.label} — ${status}`}
            className={cn(
                pill,
                'cursor-pointer',
                held && 'border-warning/60',
                !picked && 'text-muted-foreground'
            )}
        >
            <Checkbox
                checked={picked}
                disabled={disabled}
                onCheckedChange={(next) => onToggle(next === true)}
                aria-label={
                    intl.formatMessage(messages.pick, {
                        record: recordName,
                        axis: axis.label,
                        status
                    }) + (held ? `, ${intl.formatMessage(messages.held)}` : '')
                }
            />
            {code}
            {held ? (
                <ShieldAlert className="size-3.5 text-warning" aria-hidden />
            ) : null}
        </label>
    );
}
