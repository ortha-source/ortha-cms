import { Children, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    Spinner
} from '@orthacms/design-system';
import type { Segment } from '../../../domain/types';
import {
    deleteConsequences,
    type WorkspaceUsageItem
} from '../../../domain/usage';
import { useSegmentUsage } from '../../../application/hooks';

const messages = defineMessages({
    title: {
        id: 'segments.delete.title',
        defaultMessage: 'Delete “{name}”?'
    },
    named: {
        id: 'segments.delete.named',
        defaultMessage:
            '{count, plural, one {# entry names} other {# entries name}} this audience. After deleting:'
    },
    allowed: {
        id: 'segments.delete.allowed',
        defaultMessage:
            '{entries} — no longer shown to {name} readers only; they follow their other rules, or become public'
    },
    allowedOne: {
        id: 'segments.delete.allowedOne',
        defaultMessage:
            '{entries} — no longer shown to {name} readers only; it follows its other rules, or becomes public'
    },
    denied: {
        id: 'segments.delete.denied',
        defaultMessage:
            '{entries} — {name} readers can see {count, plural, one {it} other {them}} again'
    },
    more: {
        id: 'segments.delete.more',
        defaultMessage: '{count, plural, one {# more} other {# more}}'
    },
    unlisted: {
        id: 'segments.delete.unlisted',
        defaultMessage:
            '{count, plural, one {# more entry} other {# more entries}}, listed in records, change the same way.'
    },
    untitled: {
        id: 'segments.delete.untitled',
        defaultMessage: 'an untitled entry'
    },
    elsewhere: {
        id: 'segments.delete.elsewhere',
        defaultMessage:
            '{count, plural, one {# more entry} other {# more entries}} in workspaces you can’t open will change the same way.'
    },
    unused: {
        id: 'segments.delete.unused',
        defaultMessage:
            'No entry names it, so nothing any reader sees will change.'
    },
    generic: {
        id: 'segments.delete.generic',
        defaultMessage:
            'It is removed from every entry that names it. An entry that only refused this audience becomes readable by everyone; an entry that only allowed it is readable by the other audiences it names, or by everyone when it named no other.'
    },
    loading: {
        id: 'segments.delete.loading',
        defaultMessage: 'Checking which entries name it…'
    },
    cancel: { id: 'segments.delete.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'segments.delete.confirm',
        defaultMessage: 'Delete audience'
    }
});

/** Entry titles named in one line before the rest are counted. */
const NAMED = 3;

type DeleteSegmentDialogProps = {
    /** The audience to delete; `null` keeps the dialog closed. */
    segment: Segment | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    busy?: boolean;
    /** Where focus goes on close — see `ConfirmDialog.onCloseAutoFocus`. */
    onCloseAutoFocus?: (event: Event) => void;
};

/**
 * Deleting an audience, with **who will see what** afterwards.
 *
 * The real consequence of a delete is not the row going away — it is every
 * entry that named the audience changing who reads it, at once. So the
 * confirmation lists them, split by side: an entry that **allowed** it stops
 * being shown to that audience only (it follows its other rules, or becomes
 * public when it named no other), and one that **refused** it can be seen by
 * those readers again.
 *
 * The entries come from the workspace-scoped usage reads, so only those the
 * caller could open are named; the rest of the installation-wide `usageCount`
 * is counted as "in workspaces you can't open". While the reads are in flight
 * the dialog says so; if they fail it falls back to the rule in words rather
 * than holding the delete hostage to a list.
 */
export function DeleteSegmentDialog({
    segment,
    onOpenChange,
    onConfirm,
    busy = false,
    onCloseAutoFocus
}: DeleteSegmentDialogProps) {
    const intl = useIntl();
    const usage = useSegmentUsage(segment?.id);
    const name = segment?.label ?? '';
    const { allowed, denied } = deleteConsequences(usage.items);
    const elsewhere = Math.max(
        0,
        (segment?.usageCount ?? 0) - (usage.enabled ? usage.total : 0)
    );

    /** "A, B and 2 more" — titles in bold, the rest counted. */
    const entries = (items: readonly WorkspaceUsageItem[]) => {
        const named: ReactNode[] = items.slice(0, NAMED).map((item) => (
            <b
                key={`${item.workspaceId}/${item.entryId}`}
                className="font-semibold text-foreground"
            >
                {item.title ?? intl.formatMessage(messages.untitled)}
            </b>
        ));
        const rest = items.length - named.length;
        if (rest > 0) {
            named.push(intl.formatMessage(messages.more, { count: rest }));
        }
        return Children.toArray(
            intl.formatList(named, { type: 'conjunction' })
        );
    };

    // Past the per-workspace page the usage read lists, entries are counted
    // rather than sorted onto a side — saying which side they are on would be
    // a guess.
    const unlisted = Math.max(0, usage.total - usage.items.length);

    let body: ReactNode;
    if (!usage.enabled || usage.isError) {
        body = (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(
                    (segment?.usageCount ?? 0) > 0
                        ? messages.generic
                        : messages.unused
                )}
            </p>
        );
    } else if (usage.isPending) {
        body = (
            <div role="status" className="flex flex-col gap-2">
                <span className="sr-only">
                    {intl.formatMessage(messages.loading)}
                </span>
                <Skeleton aria-hidden className="h-4 w-2/3" />
                <Skeleton aria-hidden className="h-14 w-full rounded-lg" />
            </div>
        );
    } else if (usage.total === 0 && elsewhere === 0) {
        body = (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.unused)}
            </p>
        );
    } else {
        body = (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground">
                    {intl.formatMessage(messages.named, {
                        count: usage.total + elsewhere
                    })}
                </p>
                <ul className="flex flex-col gap-1 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                    {allowed.length ? (
                        <li className="ml-4 list-disc">
                            {Children.toArray(
                                intl.formatMessage(
                                    allowed.length === 1
                                        ? messages.allowedOne
                                        : messages.allowed,
                                    { entries: entries(allowed), name }
                                )
                            )}
                        </li>
                    ) : null}
                    {denied.length ? (
                        <li className="ml-4 list-disc">
                            {Children.toArray(
                                intl.formatMessage(messages.denied, {
                                    entries: entries(denied),
                                    name,
                                    count: denied.length
                                })
                            )}
                        </li>
                    ) : null}
                    {unlisted > 0 ? (
                        <li className="ml-4 list-disc">
                            {intl.formatMessage(messages.unlisted, {
                                count: unlisted
                            })}
                        </li>
                    ) : null}
                    {elsewhere > 0 ? (
                        <li className="ml-4 list-disc">
                            {intl.formatMessage(messages.elsewhere, {
                                count: elsewhere
                            })}
                        </li>
                    ) : null}
                </ul>
            </div>
        );
    }

    return (
        <Dialog
            open={segment !== null}
            onOpenChange={(next) => {
                if (!busy) onOpenChange(next);
            }}
        >
            <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, { name })}
                    </DialogTitle>
                    {/* The description is the consequence, so the dialog is
                        announced with it — but a list cannot live inside the
                        `<p>` DialogDescription renders, so it names the body. */}
                    <DialogDescription asChild>
                        <div>{body}</div>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={onConfirm}
                    >
                        {busy ? <Spinner aria-hidden /> : null}
                        {intl.formatMessage(messages.confirm)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
