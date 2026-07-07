import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    ChevronRight,
    MoreHorizontal,
    PanelLeft,
    Save,
    Send,
    Trash2,
    Undo2
} from 'lucide-react';
import {
    Badge,
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Spinner,
    cn
} from '@ortha-cms/design-system';
import type { EntryStatus } from '../../../../types/contentType';
import { ENTRY_STATUS } from '../../../../constants';
import type { PrimaryAction } from '../EntrySidebar/SidebarActionBar';

const messages = defineMessages({
    root: { id: 'content.record.top.root', defaultMessage: 'Content' },
    untitled: {
        id: 'content.record.top.untitled',
        defaultMessage: 'Untitled'
    },
    showList: {
        id: 'content.record.top.showList',
        defaultMessage: 'Back to records'
    },
    moreActions: {
        id: 'content.record.top.moreActions',
        defaultMessage: 'More actions'
    },
    statusDraft: {
        id: 'content.record.top.statusDraft',
        defaultMessage: 'Draft'
    },
    statusPublished: {
        id: 'content.record.top.statusPublished',
        defaultMessage: 'Published'
    },
    save: { id: 'content.record.top.save', defaultMessage: 'Save' },
    saveDraft: {
        id: 'content.record.top.saveDraft',
        defaultMessage: 'Save draft'
    },
    publish: { id: 'content.record.top.publish', defaultMessage: 'Publish' },
    publishAndSave: {
        id: 'content.record.top.publishAndSave',
        defaultMessage: 'Save & publish'
    },
    unpublish: {
        id: 'content.record.top.unpublish',
        defaultMessage: 'Unpublish'
    },
    remove: { id: 'content.record.top.delete', defaultMessage: 'Delete' },
    deleteTitle: {
        id: 'content.record.top.deleteTitle',
        defaultMessage: 'Delete this entry?'
    },
    deleteBody: {
        id: 'content.record.top.deleteBody',
        defaultMessage:
            'It will be moved to the trash, where it can be restored.'
    },
    deleteBodyHard: {
        id: 'content.record.top.deleteBodyHard',
        defaultMessage: 'This permanently removes the entry and can’t be undone.'
    }
});

/** Icon + label for the primary button per kind. */
const PRIMARY_META = {
    publish: { icon: Send, label: messages.publish },
    save: { icon: Save, label: messages.save },
    saveDraft: { icon: Save, label: messages.saveDraft }
} as const;

/**
 * The record editor's fixed top bar: a back-to-records toggle + breadcrumb
 * (`Content › {type} › {record}`) + status badge on the left, and the primary
 * action (Publish / Save) beside a ⋯ menu (Save draft, Save & publish,
 * Unpublish, Delete) on the right. The action set + permission gating are
 * decided by the editor and passed in; this bar owns only the delete confirm.
 */
export function EntryTopBar({
    typeLabel,
    recordName,
    status,
    publishable,
    paranoid,
    busy,
    saving,
    primary,
    showSaveDraft,
    showPublish,
    showUnpublish,
    showDelete,
    onExit,
    onSaveDraft,
    onPublish,
    onUnpublish,
    onDelete
}: {
    typeLabel: string;
    recordName?: string;
    status?: EntryStatus;
    publishable: boolean;
    paranoid: boolean;
    busy: boolean;
    saving: boolean;
    primary: PrimaryAction | null;
    showSaveDraft: boolean;
    showPublish: boolean;
    showUnpublish: boolean;
    showDelete: boolean;
    /** Leave the editor (back to the records list / app nav). */
    onExit: () => void;
    onSaveDraft: () => void;
    onPublish: () => void;
    onUnpublish?: () => void;
    onDelete?: () => void;
}) {
    const intl = useIntl();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const published = status === ENTRY_STATUS.Published;
    const hasMenu = showSaveDraft || showPublish || showUnpublish || showDelete;
    const primaryMeta = primary ? PRIMARY_META[primary.kind] : null;
    const PrimaryIcon = primaryMeta?.icon;

    return (
        <header className="flex h-14 flex-none items-center justify-between gap-3 border-b bg-background px-4">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onExit}
                    aria-label={intl.formatMessage(messages.showList)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-accent"
                >
                    <PanelLeft className="size-4" aria-hidden />
                </button>

                <nav
                    aria-label="Breadcrumb"
                    className="flex min-w-0 items-center gap-1.5 text-[13px]"
                >
                    <span className="text-muted-foreground">
                        {intl.formatMessage(messages.root)}
                    </span>
                    <ChevronRight
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                    <span className="truncate text-muted-foreground">
                        {typeLabel}
                    </span>
                    <ChevronRight
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                    <span className="truncate font-medium">
                        {recordName || intl.formatMessage(messages.untitled)}
                    </span>
                </nav>

                {publishable ? (
                    <Badge
                        variant="secondary"
                        className="shrink-0 rounded-md text-[11px] font-medium"
                    >
                        {intl.formatMessage(
                            published
                                ? messages.statusPublished
                                : messages.statusDraft
                        )}
                    </Badge>
                ) : null}
            </div>

            <div className="flex flex-none items-center gap-2">
                {primary && primaryMeta && PrimaryIcon ? (
                    <Button
                        type="button"
                        onClick={primary.onClick}
                        disabled={busy}
                        className="h-9"
                    >
                        {saving ? (
                            <Spinner aria-hidden />
                        ) : (
                            <PrimaryIcon aria-hidden />
                        )}
                        {intl.formatMessage(primaryMeta.label)}
                    </Button>
                ) : null}

                {hasMenu ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={busy}
                                aria-label={intl.formatMessage(
                                    messages.moreActions
                                )}
                                className="size-9 shadow-none"
                            >
                                <MoreHorizontal className="size-4" aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {showSaveDraft ? (
                                <DropdownMenuItem onSelect={onSaveDraft}>
                                    <Save aria-hidden />
                                    {intl.formatMessage(messages.saveDraft)}
                                </DropdownMenuItem>
                            ) : null}
                            {showPublish ? (
                                <DropdownMenuItem onSelect={onPublish}>
                                    <Send aria-hidden />
                                    {intl.formatMessage(messages.publishAndSave)}
                                </DropdownMenuItem>
                            ) : null}
                            {showUnpublish && onUnpublish ? (
                                <DropdownMenuItem onSelect={onUnpublish}>
                                    <Undo2 aria-hidden />
                                    {intl.formatMessage(messages.unpublish)}
                                </DropdownMenuItem>
                            ) : null}
                            {showDelete ? (
                                <>
                                    {showSaveDraft ||
                                    showPublish ||
                                    showUnpublish ? (
                                        <DropdownMenuSeparator />
                                    ) : null}
                                    <DropdownMenuItem
                                        onSelect={() => setConfirmDelete(true)}
                                        className={cn(
                                            'text-destructive focus:text-destructive'
                                        )}
                                    >
                                        <Trash2 aria-hidden />
                                        {intl.formatMessage(messages.remove)}
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
            </div>

            {showDelete && onDelete ? (
                <ConfirmDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                    title={intl.formatMessage(messages.deleteTitle)}
                    description={intl.formatMessage(
                        paranoid ? messages.deleteBody : messages.deleteBodyHard
                    )}
                    confirmLabel={intl.formatMessage(messages.remove)}
                    confirmVariant="destructive"
                    busy={busy}
                    onConfirm={() => {
                        onDelete();
                        setConfirmDelete(false);
                    }}
                />
            ) : null}
        </header>
    );
}
