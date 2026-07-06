import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight, Ellipsis, PanelLeft } from 'lucide-react';
import {
    Badge,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    cn
} from '@ortha-cms/design-system';
import type { RecordStatus } from '../../../types/recordDraft';
import type { SaveState } from '../../../hooks/useRecordEditor';

const messages = defineMessages({
    breadcrumbRoot: {
        id: 'content.record.top.root',
        defaultMessage: 'Content'
    },
    untitled: { id: 'content.record.top.untitled', defaultMessage: 'Untitled' },
    saved: { id: 'content.record.top.saved', defaultMessage: 'Saved just now' },
    saving: { id: 'content.record.top.saving', defaultMessage: 'Saving...' },
    published: {
        id: 'content.record.top.published',
        defaultMessage: 'Published just now'
    },
    publish: { id: 'content.record.top.publish', defaultMessage: 'Publish' },
    duplicate: {
        id: 'content.record.top.duplicate',
        defaultMessage: 'Duplicate'
    },
    unpublish: {
        id: 'content.record.top.unpublish',
        defaultMessage: 'Unpublish'
    },
    remove: { id: 'content.record.top.delete', defaultMessage: 'Delete' },
    statusDraft: {
        id: 'content.record.top.statusDraft',
        defaultMessage: 'Draft'
    },
    statusPublished: {
        id: 'content.record.top.statusPublished',
        defaultMessage: 'Published'
    },
    showSidebar: {
        id: 'content.record.top.showSidebar',
        defaultMessage: 'Show sidebar'
    },
    moreActions: {
        id: 'content.record.top.moreActions',
        defaultMessage: 'More actions'
    }
});

/** Autosave indicator copy for the current save lifecycle state. */
function saveMessage(state: SaveState) {
    if (state === 'saving') return messages.saving;
    if (state === 'published') return messages.published;
    return messages.saved;
}

/**
 * The fixed 56px top bar: the sidebar toggle + breadcrumb + status badge on the
 * left, and the autosave indicator, Publish button, and overflow menu on the
 * right. Publish reads *disabled* while the gate blocks, but stays clickable —
 * a blocked click jumps to the first offending field instead of publishing.
 */
export function RecordTopBar({
    collectionLabel,
    displayName,
    status,
    saveState,
    blocking,
    onShowSidebar,
    onPublish,
    onJumpToBlocking,
    onDuplicate,
    onUnpublish,
    onDelete
}: {
    collectionLabel: string;
    displayName?: string;
    status: RecordStatus;
    saveState: SaveState;
    blocking: boolean;
    onShowSidebar: () => void;
    onPublish: () => void;
    onJumpToBlocking: () => void;
    onDuplicate: () => void;
    onUnpublish: () => void;
    onDelete: () => void;
}) {
    const intl = useIntl();
    const published = status === 'published';

    return (
        <header className="flex h-14 flex-none items-center justify-between gap-3 border-b bg-background px-4">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onShowSidebar}
                    aria-label={intl.formatMessage(messages.showSidebar)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-accent"
                >
                    <PanelLeft className="size-4" aria-hidden />
                </button>

                <nav
                    aria-label="Breadcrumb"
                    className="flex min-w-0 items-center gap-1.5 text-[13px]"
                >
                    <span className="text-muted-foreground">
                        {intl.formatMessage(messages.breadcrumbRoot)}
                    </span>
                    <ChevronRight
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                    <span className="truncate text-muted-foreground">
                        {collectionLabel}
                    </span>
                    <ChevronRight
                        className="size-3 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                    <span className="truncate font-medium">
                        {displayName ?? intl.formatMessage(messages.untitled)}
                    </span>
                </nav>

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
            </div>

            <div className="flex flex-none items-center gap-2">
                <span
                    aria-live="polite"
                    className="text-xs text-muted-foreground"
                >
                    {intl.formatMessage(saveMessage(saveState))}
                </span>

                <Button
                    type="button"
                    aria-disabled={blocking || undefined}
                    onClick={blocking ? onJumpToBlocking : onPublish}
                    className={cn(
                        'h-9 rounded-xl',
                        blocking && 'cursor-not-allowed opacity-50'
                    )}
                >
                    {intl.formatMessage(messages.publish)}
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={intl.formatMessage(messages.moreActions)}
                            className="size-9 rounded-xl shadow-none"
                        >
                            <Ellipsis className="size-4" aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={onDuplicate}>
                            {intl.formatMessage(messages.duplicate)}
                        </DropdownMenuItem>
                        {published ? (
                            <DropdownMenuItem onSelect={onUnpublish}>
                                {intl.formatMessage(messages.unpublish)}
                            </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={onDelete}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            {intl.formatMessage(messages.remove)}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
