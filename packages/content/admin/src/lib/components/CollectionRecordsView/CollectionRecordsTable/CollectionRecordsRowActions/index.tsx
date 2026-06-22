import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Copy, MoreHorizontal, Pencil, Send, Undo2 } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    toast
} from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../../types/contentType';

/** Intl descriptors for {@link CollectionRecordsRowActions}, co-located. */
const messages = defineMessages({
    open: {
        id: 'content.records.actions.open',
        defaultMessage: 'Actions for this record'
    },
    edit: { id: 'content.records.actions.edit', defaultMessage: 'Edit' },
    publish: {
        id: 'content.records.actions.publish',
        defaultMessage: 'Publish'
    },
    unpublish: {
        id: 'content.records.actions.unpublish',
        defaultMessage: 'Unpublish'
    },
    copyId: {
        id: 'content.records.actions.copyId',
        defaultMessage: 'Copy ID'
    },
    copied: {
        id: 'content.records.actions.copied.toast',
        defaultMessage: 'Copied record ID'
    },
    copyFailed: {
        id: 'content.records.actions.copyFailed.toast',
        defaultMessage: 'Couldn’t copy the ID'
    },
    comingSoon: {
        id: 'content.records.actions.comingSoon.toast',
        defaultMessage: 'That action isn’t available yet.'
    }
});

/**
 * The per-row actions menu for the records table: **Edit** (routes to the
 * entry's detail/edit stub), **Publish/Unpublish** (shown only for publishable
 * types, label driven by the row's current `status` — not yet wired, surfaces a
 * "coming soon" toast), and **Copy ID** (writes the record id to the clipboard).
 * `modal={false}` so the open menu doesn't trap focus on a row that's also a
 * navigation target; the containing cell stops click propagation so opening the
 * menu never triggers the row's navigation.
 */
export function CollectionRecordsRowActions({
    record,
    typePath,
    publishable
}: {
    /** The record this menu acts on. */
    record: EntryRecord;
    /** Absolute path to this type, e.g. `/workspaces/:id/content/:typeName`. */
    typePath: string;
    /** Whether the type has a publish workflow (drives Publish/Unpublish). */
    publishable: boolean;
}) {
    const intl = useIntl();
    const navigate = useNavigate();

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(record.id);
            toast(intl.formatMessage(messages.copied));
        } catch {
            toast.error(intl.formatMessage(messages.copyFailed));
        }
    };

    // Publish/Unpublish aren't wired yet — surface intent without faking success.
    const comingSoon = () => toast(intl.formatMessage(messages.comingSoon));

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={intl.formatMessage(messages.open)}
                >
                    <MoreHorizontal aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                    onSelect={() => navigate(`${typePath}/${record.id}`)}
                >
                    <Pencil aria-hidden />
                    {intl.formatMessage(messages.edit)}
                </DropdownMenuItem>

                {publishable ? (
                    <DropdownMenuItem onSelect={comingSoon}>
                        {record.status === 'published' ? (
                            <>
                                <Undo2 aria-hidden />
                                {intl.formatMessage(messages.unpublish)}
                            </>
                        ) : (
                            <>
                                <Send aria-hidden />
                                {intl.formatMessage(messages.publish)}
                            </>
                        )}
                    </DropdownMenuItem>
                ) : null}

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={copyId}>
                    <Copy aria-hidden />
                    {intl.formatMessage(messages.copyId)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
