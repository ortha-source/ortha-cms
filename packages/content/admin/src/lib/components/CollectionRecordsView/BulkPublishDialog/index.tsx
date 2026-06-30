import { useEffect } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    ExternalLink,
    MinusCircle,
    XCircle
} from 'lucide-react';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    Button,
    buttonVariants,
    cn,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Spinner,
    toast
} from '@ortha-cms/design-system';
import type { BulkPublishVerdict } from '../../../types/contentType';
import { BULK_VERDICT, CONTENT_SEGMENT } from '../../../constants';
import { useBulkEntryActions } from '../../../api/useBulkEntryActions';

const messages = defineMessages({
    title: {
        id: 'content.bulkPublish.title',
        defaultMessage: 'Publish {count, plural, one {# record} other {# records}}?'
    },
    body: {
        id: 'content.bulkPublish.body',
        defaultMessage:
            'Each record is checked below. Only valid drafts will publish.'
    },
    loading: {
        id: 'content.bulkPublish.loading',
        defaultMessage: 'Checking records…'
    },
    error: {
        id: 'content.bulkPublish.error',
        defaultMessage: 'Couldn’t check these records. Please try again.'
    },
    willPublish: {
        id: 'content.bulkPublish.willPublish',
        defaultMessage: 'Will publish'
    },
    alreadyPublished: {
        id: 'content.bulkPublish.alreadyPublished',
        defaultMessage: 'Already published'
    },
    notFound: {
        id: 'content.bulkPublish.notFound',
        defaultMessage: 'No longer available'
    },
    blocked: {
        id: 'content.bulkPublish.blocked',
        defaultMessage:
            '{count, plural, one {# issue} other {# issues}}'
    },
    openRecord: {
        id: 'content.bulkPublish.openRecord',
        defaultMessage: 'Open record in a new tab'
    },
    toggleIssues: {
        id: 'content.bulkPublish.toggleIssues',
        defaultMessage: 'Show publishing issues'
    },
    cancel: { id: 'content.bulkPublish.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'content.bulkPublish.confirm',
        defaultMessage:
            'Publish {count, plural, =0 {none} one {# valid} other {# valid}}'
    },
    summaryReady: {
        id: 'content.bulkPublish.summaryReady',
        defaultMessage:
            '{count, plural, one {# record will publish} other {# records will publish}}.'
    },
    summaryNone: {
        id: 'content.bulkPublish.summaryNone',
        defaultMessage:
            'None of the selected records can be published — they’re already published or blocked.'
    },
    result: {
        id: 'content.bulkPublish.result',
        defaultMessage:
            '{count, plural, one {# record published} other {# records published}}.'
    },
    failed: {
        id: 'content.bulkPublish.failed',
        defaultMessage: 'Publishing didn’t complete. Please try again.'
    }
});

/**
 * One verdict as a collapsible row: a header showing the record's title + id, a
 * status icon, the verdict note, and an "open in a new tab" button; when the
 * record is **blocked**, the row expands to reveal its validation issues.
 */
function VerdictRow({
    item,
    recordHref
}: {
    item: BulkPublishVerdict;
    /** Builds the entry-editor URL for a record id. */
    recordHref: (id: string) => string;
}) {
    const intl = useIntl();

    const meta = {
        [BULK_VERDICT.Publishable]: {
            icon: <CheckCircle2 className="size-4 text-primary" aria-hidden />,
            note: intl.formatMessage(messages.willPublish),
            danger: false
        },
        [BULK_VERDICT.AlreadyPublished]: {
            icon: (
                <MinusCircle
                    className="size-4 text-muted-foreground"
                    aria-hidden
                />
            ),
            note: intl.formatMessage(messages.alreadyPublished),
            danger: false
        },
        [BULK_VERDICT.NotFound]: {
            icon: (
                <AlertCircle
                    className="size-4 text-muted-foreground"
                    aria-hidden
                />
            ),
            note: intl.formatMessage(messages.notFound),
            danger: false
        },
        [BULK_VERDICT.Blocked]: {
            icon: <XCircle className="size-4 text-destructive" aria-hidden />,
            note: intl.formatMessage(messages.blocked, {
                count: item.issues.length
            }),
            danger: true
        }
    }[item.verdict];

    const hasIssues = item.issues.length > 0;
    // The record may have vanished (NotFound) — nothing to open in that case.
    const canOpen = item.verdict !== BULK_VERDICT.NotFound;

    const header = (
        <div className="flex items-center gap-2 py-2">
            {hasIssues ? (
                <CollapsibleTrigger
                    className="group flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={intl.formatMessage(messages.toggleIssues)}
                >
                    <ChevronRight
                        className="size-4 transition-transform group-data-[state=open]:rotate-90"
                        aria-hidden
                    />
                </CollapsibleTrigger>
            ) : (
                <span className="size-6 shrink-0" aria-hidden />
            )}
            <span className="shrink-0">{meta.icon}</span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.title}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                    {item.id}
                </p>
            </div>
            <span
                className={cn(
                    'shrink-0 text-xs',
                    meta.danger ? 'text-destructive' : 'text-muted-foreground'
                )}
            >
                {meta.note}
            </span>
            {canOpen && (
                <a
                    href={recordHref(item.id)}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                        buttonVariants({ variant: 'ghost', size: 'icon' }),
                        'size-7 shrink-0 text-muted-foreground'
                    )}
                    aria-label={intl.formatMessage(messages.openRecord)}
                >
                    <ExternalLink className="size-4" aria-hidden />
                </a>
            )}
        </div>
    );

    if (!hasIssues) {
        return <li>{header}</li>;
    }

    return (
        <li>
            <Collapsible>
                {header}
                <CollapsibleContent>
                    <ul className="mb-2 ml-8 flex flex-col gap-1">
                        {item.issues.map((issue, index) => (
                            <li
                                key={`${issue.field}-${index}`}
                                className="text-xs text-destructive"
                            >
                                <span className="font-medium">
                                    {issue.field}
                                </span>
                                : {issue.message}
                            </li>
                        ))}
                    </ul>
                </CollapsibleContent>
            </Collapsible>
        </li>
    );
}

/**
 * The bulk-publish pre-flight modal. On open it dry-runs a publish over the
 * selected ids (`previewPublish`, which validates each server-side and writes
 * nothing) and lists each record's verdict — will publish / already published /
 * blocked (with its validation issues) / no longer available. Confirming
 * publishes **only the valid drafts** (`publish`, which re-validates on the
 * server), toasts how many went out, clears the selection, and closes.
 */
export function BulkPublishDialog({
    open,
    onOpenChange,
    typeName,
    ids,
    onPublished
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    typeName: string;
    /** The selected entry ids to publish. */
    ids: string[];
    /** Called after a successful publish (e.g. to clear the selection). */
    onPublished: () => void;
}) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const { previewPublish, publish } = useBulkEntryActions(typeName);
    const { mutate: runPreview, reset: resetPreview } = previewPublish;

    // The entry-editor URL for a record, opened in a new tab from a verdict row.
    const recordHref = (id: string) =>
        `/workspaces/${workspace.id}/${CONTENT_SEGMENT}/${typeName}/${id}`;

    // Dry-run whenever the dialog opens for the current selection.
    useEffect(() => {
        if (open) runPreview(ids);
        else resetPreview();
        // `ids` is captured at open; selection is frozen while the dialog is up.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const items = previewPublish.data?.items ?? [];
    const validCount = items.filter(
        (item) => item.verdict === BULK_VERDICT.Publishable
    ).length;

    const onConfirm = () => {
        publish.mutate(ids, {
            onSuccess: (result) => {
                toast(
                    intl.formatMessage(messages.result, {
                        count: result.published.length
                    })
                );
                onPublished();
                onOpenChange(false);
            },
            onError: () =>
                toast.error(intl.formatMessage(messages.failed))
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!publish.isPending) onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, {
                            count: ids.length
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.body)}
                    </DialogDescription>
                </DialogHeader>

                {previewPublish.isPending ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Spinner aria-hidden />
                        {intl.formatMessage(messages.loading)}
                    </div>
                ) : previewPublish.isError ? (
                    <p
                        role="alert"
                        className="py-4 text-sm text-destructive"
                    >
                        {intl.formatMessage(messages.error)}
                    </p>
                ) : (
                    <>
                        <ul className="max-h-96 divide-y overflow-auto">
                            {items.map((item) => (
                                <VerdictRow
                                    key={item.id}
                                    item={item}
                                    recordHref={recordHref}
                                />
                            ))}
                        </ul>
                        {items.length > 0 && (
                            // Announced summary so a screen-reader user learns the
                            // outcome — and why the confirm button is disabled when
                            // nothing is publishable — without scanning every row.
                            <p
                                role="status"
                                className="text-sm text-muted-foreground"
                            >
                                {validCount === 0
                                    ? intl.formatMessage(messages.summaryNone)
                                    : intl.formatMessage(
                                          messages.summaryReady,
                                          { count: validCount }
                                      )}
                            </p>
                        )}
                    </>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={publish.isPending}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={
                            publish.isPending ||
                            previewPublish.isPending ||
                            validCount === 0
                        }
                    >
                        {publish.isPending ? <Spinner aria-hidden /> : null}
                        {intl.formatMessage(messages.confirm, {
                            count: validCount
                        })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
