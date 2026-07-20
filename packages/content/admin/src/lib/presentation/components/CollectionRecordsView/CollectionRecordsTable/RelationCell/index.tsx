import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown } from 'lucide-react';
import {
    Badge,
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@ortha-cms/design-system';
import type {
    ContentField,
    RelationFieldView
} from '../../../../../domain/types/contentType';
import { RelationCellList } from './RelationCellList';

/** Co-located labels for the relation cell's trigger. */
const messages = defineMessages({
    trigger: {
        id: 'content.records.relation.trigger',
        defaultMessage:
            '{count, plural, one {Show # linked record} other {Show # linked records}} for {field}'
    },
    empty: {
        id: 'content.records.relation.empty',
        defaultMessage: 'No linked records'
    }
});

/** The em-dash placeholder shown when a relation holds nothing. */
const EMPTY = '—';

/**
 * Marks a relation cell's trigger so an open dropdown can recognise a click on
 * *another* cell's trigger and leave that transition to the table.
 */
const TRIGGER_ATTR = 'data-relation-trigger';

/**
 * A relation column's cell: a titled trigger (the first linked record plus a
 * `+N` overflow) opening a popover of the linked records, each a link to that
 * record's own editor in a new tab.
 *
 * The collapsed state renders entirely from the list response's capped
 * `preview`, so it costs no request. The popover's contents live in
 * {@link RelationCellList}, which is mounted only while open — that is what
 * keeps a page of 50 relation cells from registering 50 idle link queries.
 *
 * **Open state is owned by the table**, not this cell: the table tracks a
 * single open cell, so opening one dropdown closes any other (classic dropdown
 * semantics). Per-cell state would let two cells be open at once — Radix's
 * outside-dismiss doesn't coordinate independent popovers.
 */
export function RelationCell({
    field,
    preview,
    typeName,
    recordId,
    workspaceId,
    open,
    onOpenChange
}: {
    /** The relation field this column renders. */
    field: ContentField;
    /** The server's capped preview for this row + field, if any. */
    preview: RelationFieldView | undefined;
    /** Machine name of the type being listed (for the links query). */
    typeName: string;
    /** The row's entry id (the link owner). */
    recordId: string;
    /** Open workspace, for building the related record's path. */
    workspaceId: string;
    /** Whether this cell is the table's currently open dropdown. */
    open: boolean;
    /** Report this cell opening or closing; the table owns which one is open. */
    onOpenChange: (open: boolean) => void;
}) {
    const intl = useIntl();

    const target = field.relation?.to;
    const items = preview?.items ?? [];
    const total = preview?.total ?? 0;

    if (!target || total === 0) {
        return (
            <span className="text-muted-foreground">
                <span aria-hidden>{EMPTY}</span>
                <span className="sr-only">
                    {intl.formatMessage(messages.empty)}
                </span>
            </span>
        );
    }

    /**
     * A dismissal caused by another relation trigger is left to the table,
     * which closes this cell by opening that one. Radix defers such a dismissal
     * to the click, so letting it through would close the popover that click
     * just opened.
     */
    const isTriggerDismissal = (originalEvent: { target: EventTarget | null }) =>
        Boolean(
            (originalEvent.target as HTMLElement | null)?.closest?.(
                `[${TRIGGER_ATTR}]`
            )
        );

    const label = field.admin['label'];
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    {...{ [TRIGGER_ATTR]: '' }}
                    // The row navigates on click — never let it through.
                    onClick={(event) => event.stopPropagation()}
                    className="-mx-2 h-7 max-w-full gap-1.5 px-2 font-normal"
                    aria-label={intl.formatMessage(messages.trigger, {
                        count: total,
                        field: typeof label === 'string' ? label : field.name
                    })}
                >
                    <span className="truncate">
                        {items[0]?.title ?? EMPTY}
                    </span>
                    {total > 1 ? (
                        <Badge variant="secondary">+{total - 1}</Badge>
                    ) : null}
                    <ChevronDown
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-72 p-1"
                onClick={(event) => event.stopPropagation()}
                onPointerDownOutside={(event) => {
                    if (isTriggerDismissal(event.detail.originalEvent))
                        event.preventDefault();
                }}
                onFocusOutside={(event) => {
                    if (isTriggerDismissal(event.detail.originalEvent))
                        event.preventDefault();
                }}
            >
                <RelationCellList
                    field={field}
                    target={target}
                    preview={preview}
                    typeName={typeName}
                    recordId={recordId}
                    workspaceId={workspaceId}
                />
            </PopoverContent>
        </Popover>
    );
}
