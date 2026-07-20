import { useState } from 'react';
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
 * A relation column's cell: a titled trigger (the first linked record plus a
 * `+N` overflow) opening a popover of the linked records, each a link to that
 * record's own editor in a new tab.
 *
 * The collapsed state renders entirely from the list response's capped
 * `preview`, so it costs no request. The popover's contents live in
 * {@link RelationCellList}, which is mounted only while open — that is what
 * keeps a page of 50 relation cells from registering 50 idle link queries.
 */
export function RelationCell({
    field,
    preview,
    typeName,
    recordId,
    workspaceId
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
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);

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

    const label = field.admin['label'];
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    // The row navigates on click — don't let opening the
                    // popover trigger it.
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
