import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown } from 'lucide-react';
import {
    Badge,
    Button,
    Separator,
    Spinner,
    cn
} from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../../types/contentType';
import { ENTRY_STATUS } from '../../../../constants';

const messages = defineMessages({
    aside: {
        id: 'content.sidebar.aside',
        defaultMessage: 'Record actions and details'
    },
    save: { id: 'content.editor.save', defaultMessage: 'Save' },
    saveDraft: { id: 'content.editor.saveDraft', defaultMessage: 'Save draft' },
    publish: { id: 'content.editor.publish', defaultMessage: 'Save & publish' },
    saving: { id: 'content.editor.saving', defaultMessage: 'Saving…' },
    detailsShow: {
        id: 'content.sidebar.detailsShow',
        defaultMessage: 'Show details'
    },
    detailsHide: {
        id: 'content.sidebar.detailsHide',
        defaultMessage: 'Hide details'
    },
    status: { id: 'content.sidebar.status', defaultMessage: 'Status' },
    statusDraft: { id: 'content.sidebar.statusDraft', defaultMessage: 'Draft' },
    statusPublished: {
        id: 'content.sidebar.statusPublished',
        defaultMessage: 'Published'
    },
    statusNew: {
        id: 'content.sidebar.statusNew',
        defaultMessage: 'Not saved yet'
    },
    signedBy: { id: 'content.sidebar.signedBy', defaultMessage: 'Signed by' },
    created: { id: 'content.sidebar.created', defaultMessage: 'Created' },
    updated: { id: 'content.sidebar.updated', defaultMessage: 'Last updated' },
    entryId: { id: 'content.sidebar.entryId', defaultMessage: 'Entry ID' },
    empty: { id: 'content.sidebar.empty', defaultMessage: '—' }
});

/** One label/value row in the details list. */
function MetaRow({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="text-sm">{children}</dd>
        </div>
    );
}

const DETAILS_ID = 'entry-sidebar-details';

/**
 * The entry editor's right rail — a **single** panel (not separate cards) that
 * holds the primary actions (Save / Save & publish) at the top and,
 * below a separator, a **collapsible Details** block: status, who signed it off,
 * created / last-updated timestamps, and the entry id. The Details toggle lives
 * inside the panel; the actions stay visible regardless. Borderless except for a
 * single left divider, it sits flush beside the content as a full-height pane.
 */
export function EntrySidebar({
    entry,
    publishable,
    isCreate,
    saving,
    onSaveDraft,
    onPublish
}: {
    entry?: EntryRecord;
    publishable: boolean;
    isCreate: boolean;
    saving: boolean;
    /** Save without publishing (the default submit). */
    onSaveDraft: () => void;
    /** Save and mark published — only wired for publishable types. */
    onPublish: () => void;
}) {
    const intl = useIntl();
    const [detailsOpen, setDetailsOpen] = useState(true);
    const dash = intl.formatMessage(messages.empty);

    const fmt = (iso?: string) =>
        iso
            ? intl.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' })
            : dash;

    const published = entry?.status === ENTRY_STATUS.Published;
    const statusLabel = isCreate
        ? messages.statusNew
        : published
          ? messages.statusPublished
          : messages.statusDraft;

    return (
        <aside
            className="flex w-full shrink-0 flex-col gap-4 p-6 lg:w-80 lg:border-l"
            aria-label={intl.formatMessage(messages.aside)}
        >
            {/* Actions */}
            <div className="flex flex-col gap-2">
                {publishable ? (
                    <>
                        <Button
                            type="button"
                            className="w-full"
                            onClick={onPublish}
                            disabled={saving}
                        >
                            {saving ? <Spinner aria-hidden /> : null}
                            {intl.formatMessage(messages.publish)}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full shadow-none"
                            onClick={onSaveDraft}
                            disabled={saving}
                        >
                            {intl.formatMessage(messages.saveDraft)}
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        className="w-full"
                        onClick={onSaveDraft}
                        disabled={saving}
                    >
                        {saving ? <Spinner aria-hidden /> : null}
                        {intl.formatMessage(messages.save)}
                    </Button>
                )}
            </div>

            <Separator />

            {/* Details toggle */}
            <button
                type="button"
                className="flex items-center justify-between rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={detailsOpen}
                aria-controls={DETAILS_ID}
                onClick={() => setDetailsOpen((open) => !open)}
            >
                {intl.formatMessage(
                    detailsOpen ? messages.detailsHide : messages.detailsShow
                )}
                <ChevronDown
                    aria-hidden
                    className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        !detailsOpen && '-rotate-90'
                    )}
                />
            </button>

            {detailsOpen ? (
                <dl id={DETAILS_ID} className="flex flex-col gap-3">
                    <MetaRow label={intl.formatMessage(messages.status)}>
                        {isCreate ? (
                            <Badge variant="outline">
                                {intl.formatMessage(statusLabel)}
                            </Badge>
                        ) : (
                            <Badge
                                variant={published ? 'default' : 'secondary'}
                            >
                                {intl.formatMessage(statusLabel)}
                            </Badge>
                        )}
                    </MetaRow>
                    <MetaRow label={intl.formatMessage(messages.signedBy)}>
                        <span className="text-muted-foreground">{dash}</span>
                    </MetaRow>
                    <MetaRow label={intl.formatMessage(messages.created)}>
                        {fmt(entry?.createdAt)}
                    </MetaRow>
                    <MetaRow label={intl.formatMessage(messages.updated)}>
                        {fmt(entry?.updatedAt)}
                    </MetaRow>
                    <MetaRow label={intl.formatMessage(messages.entryId)}>
                        <span className="break-all font-mono text-xs text-muted-foreground">
                            {entry?.id ?? dash}
                        </span>
                    </MetaRow>
                </dl>
            ) : null}
        </aside>
    );
}
